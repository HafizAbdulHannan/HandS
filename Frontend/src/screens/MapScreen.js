import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';
import { TouchableOpacity, TextInput } from 'react-native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MapScreen() {
  const { theme, isDarkMode } = useThemeContext();
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Tabs: 'me' or 'partner'
  const [activeTab, setActiveTab] = useState('me');
  const [isSharingLive, setIsSharingLive] = useState(false);
  const [destination, setDestination] = useState('');
  
  // Trip State
  const [tripActive, setTripActive] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [tripDistance, setTripDistance] = useState('');
  const [tripETA, setTripETA] = useState('');
  const [isRouting, setIsRouting] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  // Map Ref
  const mapRef = React.useRef(null);
  
  // Live Location States
  const { socket } = useSocket();
  const { user } = useAuth();
  const room = user && user.partner ? [user._id, user.partner].sort().join('_') : null;
  const [partnerLocation, setPartnerLocation] = useState(null);

  // Refs to access latest state in location callback without re-subscribing
  const isSharingLiveRef = React.useRef(isSharingLive);
  const socketRef = React.useRef(socket);
  const roomRef = React.useRef(room);

  useEffect(() => { isSharingLiveRef.current = isSharingLive; }, [isSharingLive]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { roomRef.current = room; }, [room]);

  useEffect(() => {
    if (socket) {
      const handleReceiveLocation = (loc) => {
        setPartnerLocation(loc);
      };
      socket.on('receive_location', handleReceiveLocation);
      return () => {
        socket.off('receive_location', handleReceiveLocation);
      };
    }
  }, [socket]);

  useEffect(() => {
    const loadShareState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('isSharingLive');
        if (savedState !== null) {
          setIsSharingLive(JSON.parse(savedState));
        }
      } catch (e) {
        console.log('Failed to load sharing state', e);
      }
    };
    loadShareState();
  }, []);

  useEffect(() => {
    let locationSubscriber;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      locationSubscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (loc) => {
          setLocation(loc.coords);
          // Convert speed from m/s to km/h (if available and > 0)
          const currentSpeed = loc.coords.speed && loc.coords.speed > 0 ? (loc.coords.speed * 3.6).toFixed(1) : 0;
          setSpeed(currentSpeed);
          
          if (isSharingLiveRef.current && socketRef.current && roomRef.current) {
            socketRef.current.emit('update_location', { 
              room: roomRef.current, 
              location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude } 
            });
          }
        }
      );
    })();

    return () => {
      if (locationSubscriber) {
        locationSubscriber.remove();
      }
    };
  }, []);

  const handleStartTrip = async () => {
    if (!destination.trim() || !location) return;
    
    setIsRouting(true);
    try {
      // 1. Geocode destination using Nominatim
      const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`);
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData || geocodeData.length === 0) {
        Toast.show({ type: 'error', text1: 'Not Found', text2: 'Destination not found!' });
        setIsRouting(false);
        return;
      }

      const destLat = parseFloat(geocodeData[0].lat);
      const destLon = parseFloat(geocodeData[0].lon);

      // 2. Route using OSRM
      const startLon = location.longitude;
      const startLat = location.latitude;
      
      const osrmResponse = await fetch(`http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson`);
      const osrmData = await osrmResponse.json();

      if (osrmData.code === "Ok" && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        
        // Convert GeoJSON coordinates [lon, lat] to { latitude, longitude } for React Native Maps
        const polylineCoords = route.geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));

        setRouteCoordinates(polylineCoords);
        
        // Distance is in meters, convert to km
        const distKm = (route.distance / 1000).toFixed(1);
        setTripDistance(`${distKm} km`);

        // Duration is in seconds, convert to minutes/hours
        const durationMin = Math.round(route.duration / 60);
        if (durationMin > 60) {
          const hrs = Math.floor(durationMin / 60);
          const mins = durationMin % 60;
          setTripETA(`${hrs}h ${mins}m`);
        } else {
          setTripETA(`${durationMin} min`);
        }

        setTripActive(true);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Could not calculate route.' });
      }
    } catch (error) {
      console.log('Error calculating route:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Something went wrong calculating the trip.' });
    } finally {
      setIsRouting(false);
    }
  };

  const handleEndTrip = () => {
    setTripActive(false);
    setRouteCoordinates([]);
    setDestination('');
  };

  const handleRecenter = () => {
    const targetLoc = activeTab === 'me' ? location : partnerLocation;
    if (targetLoc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: targetLoc.latitude,
        longitude: targetLoc.longitude,
        latitudeDelta: 0.0122,
        longitudeDelta: 0.0121,
      }, 1000);
    } else if (activeTab === 'partner' && !partnerLocation) {
      Toast.show({ type: 'info', text1: 'Not Available', text2: 'Partner location not available' });
    }
  };

  const handleRefresh = async () => {
    Toast.show({ type: 'info', text1: 'Refreshing map...' });
    try {
      if (activeTab === 'me') {
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(currentLoc.coords);
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: currentLoc.coords.latitude,
            longitude: currentLoc.coords.longitude,
            latitudeDelta: 0.0122,
            longitudeDelta: 0.0121,
          }, 1000);
        }
      } else {
        // Just trigger a re-render/recentering for partner if location exists
        handleRecenter();
      }
    } catch (e) {
      console.log('Error refreshing location:', e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Live Map</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'me' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('me')}
        >
          <Text style={[styles.tabText, activeTab === 'me' ? { color: theme.colors.primary, fontWeight: 'bold' } : { color: theme.colors.textSecondary }]}>My Location</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'partner' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('partner')}
        >
          <Text style={[styles.tabText, activeTab === 'partner' ? { color: theme.colors.primary, fontWeight: 'bold' } : { color: theme.colors.textSecondary }]}>Partner's Location</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {errorMsg ? (
          <View style={[styles.center, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={[styles.errorText, { color: theme.colors.text }]}>{errorMsg}</Text>
          </View>
        ) : !location ? (
          <View style={[styles.center, { backgroundColor: theme.colors.card }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Locating...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={styles.map}
              userInterfaceStyle={isDarkMode ? "dark" : "light"}
              initialRegion={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              {activeTab === 'me' && (
                <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} title="You" pinColor={theme.colors.primary} />
              )}
              {activeTab === 'partner' && partnerLocation && (
                <Marker coordinate={{ latitude: partnerLocation.latitude, longitude: partnerLocation.longitude }} title="Partner" pinColor="#45aaf2" />
              )}
              {tripActive && routeCoordinates.length > 0 && activeTab === 'me' && (
                <>
                  <Polyline 
                    coordinates={routeCoordinates}
                    strokeColor="#45aaf2"
                    strokeWidth={4}
                  />
                  <Marker 
                    coordinate={routeCoordinates[routeCoordinates.length - 1]} 
                    title="Destination" 
                    pinColor="#2bcbba" 
                  />
                </>
              )}
            </MapView>
            
            {/* Live Speed Badge */}
            <View style={[styles.speedBadge, { backgroundColor: theme.colors.card, shadowColor: theme.colors.text }]}>
              <Text style={[styles.speedValue, { color: theme.colors.text }]}>{speed}</Text>
              <Text style={[styles.speedUnit, { color: theme.colors.textSecondary }]}>km/h</Text>
            </View>

            {/* Map Action Buttons */}
            <View style={styles.mapActionsContainer}>
              <TouchableOpacity style={[styles.mapActionButton, { backgroundColor: theme.colors.card }]} onPress={handleRefresh}>
                <Ionicons name="refresh" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mapActionButton, { backgroundColor: theme.colors.card, marginTop: 10 }]} onPress={handleRecenter}>
                <Ionicons name="locate" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Overlay UI based on active tab */}
            {activeTab === 'me' && (
              <View style={[styles.bottomPanel, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity 
                  style={styles.panelHeader} 
                  onPress={() => setIsPanelExpanded(!isPanelExpanded)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.panelTitle, { color: theme.colors.text, marginBottom: 0 }]}>Share Location</Text>
                  <Ionicons name={isPanelExpanded ? "chevron-down" : "chevron-up"} size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                
                {isPanelExpanded && (
                  <View style={{ marginTop: 16 }}>
                    <View style={styles.shareRow}>
                      <Text style={[styles.shareLabel, { color: theme.colors.textSecondary }]}>Live Tracking</Text>
                      <TouchableOpacity 
                        style={[styles.toggleBtn, isSharingLive ? { backgroundColor: '#2bcbba' } : { backgroundColor: theme.colors.border }]}
                        onPress={async () => {
                          const newState = !isSharingLive;
                          setIsSharingLive(newState);
                          try {
                            await AsyncStorage.setItem('isSharingLive', JSON.stringify(newState));
                          } catch (e) {
                            console.log('Failed to save sharing state', e);
                          }
                          
                          if (newState && socketRef.current && roomRef.current && location) {
                            socketRef.current.emit('update_location', { 
                              room: roomRef.current, 
                              location: { latitude: location.latitude, longitude: location.longitude } 
                            });
                          }
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{isSharingLive ? 'ON' : 'OFF'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.tripSection}>
                      {tripActive ? (
                        <View style={styles.activeTripCard}>
                          <Text style={[styles.activeTripTitle, { color: theme.colors.text }]}>Trip to {destination}</Text>
                          <View style={styles.tripStatsRow}>
                            <View style={styles.tripStat}>
                              <Ionicons name="map-outline" size={20} color={theme.colors.primary} />
                              <Text style={[styles.tripStatText, { color: theme.colors.textSecondary }]}>{tripDistance}</Text>
                            </View>
                            <View style={styles.tripStat}>
                              <Ionicons name="time-outline" size={20} color="#45aaf2" />
                              <Text style={[styles.tripStatText, { color: theme.colors.textSecondary }]}>{tripETA}</Text>
                            </View>
                          </View>
                          <TouchableOpacity 
                            style={[styles.primaryBtn, { backgroundColor: '#ff4757', marginTop: 15 }]}
                            onPress={handleEndTrip}
                          >
                            <Text style={styles.primaryBtnText}>End Trip</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <Text style={[styles.shareLabel, { color: theme.colors.textSecondary, marginBottom: 8 }]}>Share a Trip</Text>
                          <TextInput 
                            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                            placeholder="Enter Destination (e.g. Lahore)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={destination}
                            onChangeText={setDestination}
                          />
                          <TouchableOpacity 
                            style={[styles.primaryBtn, { backgroundColor: destination.trim() ? theme.colors.primary : theme.colors.border }]}
                            onPress={handleStartTrip}
                            disabled={!destination.trim() || isRouting}
                          >
                            {isRouting ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.primaryBtnText}>Start Trip</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'partner' && (
              partnerLocation ? (
                <View style={[styles.bottomPanel, { backgroundColor: theme.colors.card }]}>
                  <TouchableOpacity 
                    style={styles.panelHeader} 
                    onPress={() => setIsPanelExpanded(!isPanelExpanded)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.panelTitle, { color: theme.colors.text, marginBottom: 0 }]}>Partner Status</Text>
                    <Ionicons name={isPanelExpanded ? "chevron-down" : "chevron-up"} size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  {isPanelExpanded && (
                    <View style={[styles.statusRow, { marginTop: 16 }]}>
                      <Ionicons name="location" size={24} color="#45aaf2" />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.statusMainText, { color: theme.colors.text }]}>Live Tracking Enabled</Text>
                        <Text style={[styles.statusSubText, { color: theme.colors.textSecondary }]}>Last updated: Just now</Text>
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.bottomPanel, { backgroundColor: theme.colors.card }]}>
                  <TouchableOpacity 
                    style={styles.panelHeader} 
                    onPress={() => setIsPanelExpanded(!isPanelExpanded)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.panelTitle, { color: theme.colors.text, marginBottom: 0 }]}>Partner Status</Text>
                    <Ionicons name={isPanelExpanded ? "chevron-down" : "chevron-up"} size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                  {isPanelExpanded && (
                    <View style={[styles.statusRow, { marginTop: 16 }]}>
                      <Ionicons name="location-outline" size={24} color={theme.colors.textSecondary} />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.statusMainText, { color: theme.colors.text }]}>Location Not Available</Text>
                        <Text style={[styles.statusSubText, { color: theme.colors.textSecondary }]}>Your partner is not sharing their live location.</Text>
                      </View>
                    </View>
                  )}
                </View>
              )
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  title: { 
    fontSize: 34, 
    fontWeight: '800', 
    color: '#1a1a1a' 
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  map: { 
    width: '100%', 
    height: '100%' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  errorText: { 
    color: '#1a1a1a', 
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    paddingBottom: 40,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  shareLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tripSection: {
    marginTop: 10,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  primaryBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusMainText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusSubText: {
    fontSize: 14,
  },
  speedBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  speedValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  speedUnit: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  mapActionsContainer: {
    position: 'absolute',
    top: 85,
    right: 20,
    alignItems: 'center',
  },
  mapActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  activeTripCard: {
    marginTop: 5,
  },
  activeTripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tripStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tripStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  tripStatText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '600',
  }
});
