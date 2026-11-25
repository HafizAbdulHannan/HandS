import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';
import Toast from 'react-native-toast-message';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../api/axiosConfig';

const VEHICLE_OPTIONS = [
  { id: 'Car', label: 'Car', icon: 'car-outline', osrmProfile: 'driving', speedFactor: 1.0 },
  { id: 'Bike', label: 'Bike', icon: 'bicycle-outline', osrmProfile: 'driving', speedFactor: 1.15 },
  { id: 'Bicycle', label: 'Cycle', icon: 'bicycle', osrmProfile: 'cycling', speedFactor: 1.0 },
  { id: 'Walking', label: 'Walk', icon: 'walk-outline', osrmProfile: 'foot', speedFactor: 1.0 },
];

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (meters) => {
  const m = Math.max(0, Number(meters) || 0);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
};

const formatDurationMinutes = (minutes) => {
  const mins = Math.max(1, Math.round(minutes));
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  }
  return `${mins} min`;
};

const downsampleCoords = (coords, maxPoints = 220) => {
  if (!Array.isArray(coords) || coords.length <= maxPoints) return coords || [];
  const step = Math.ceil(coords.length / maxPoints);
  const sampled = coords.filter((_, idx) => idx % step === 0);
  const last = coords[coords.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
};

export default function MapScreen() {
  const { theme } = useThemeContext();
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Tabs: 'me' or 'partner'
  const [activeTab, setActiveTab] = useState('me');
  const [isSharingLive, setIsSharingLive] = useState(false);
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState('Car');

  // My Trip State
  const [tripActive, setTripActive] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [tripDistance, setTripDistance] = useState('');
  const [tripTotalMeters, setTripTotalMeters] = useState(0);
  const [coveredMeters, setCoveredMeters] = useState(0);
  const [tripETA, setTripETA] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [isRouting, setIsRouting] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  // Partner Location & Trip State
  const { socket } = useSocket();
  const { user } = useAuth();
  const partnerId = typeof user?.partner === 'object' ? user?.partner?._id : user?.partner;
  const room = user?._id && partnerId ? [user._id, partnerId].sort().join('_') : null;
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [partnerTrip, setPartnerTrip] = useState(null);
  const [partnerLastUpdated, setPartnerLastUpdated] = useState(null);

  const isSharingLiveRef = useRef(isSharingLive);
  const socketRef = useRef(socket);
  const roomRef = useRef(room);
  const tripActiveRef = useRef(tripActive);
  const activeTripPayloadRef = useRef(null);
  const lastGpsCoordRef = useRef(null);
  const coveredMetersRef = useRef(0);
  const lastGeocodeTimeRef = useRef(0);
  const lastTripDbSyncRef = useRef(0);
  const currentAddressRef = useRef('');

  useEffect(() => { isSharingLiveRef.current = isSharingLive; }, [isSharingLive]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { tripActiveRef.current = tripActive; }, [tripActive]);

  const webViewRef = useRef(null);

  const reverseGeocodeAddress = useCallback(async (latitude, longitude) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const place = results[0];
        const parts = [place.name, place.street, place.district || place.subregion, place.city].filter(Boolean);
        const unique = [...new Set(parts)];
        if (unique.length > 0) return unique.slice(0, 3).join(', ');
      }
    } catch (e) {}
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }, []);

  const leafletHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100%; background: #f8f9fa; }
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([0, 0], 2);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var myMarker = null;
        var partnerMarker = null;
        var routeLine = null;
        var destMarker = null;

        var myIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        var partnerIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        var destIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        function handleMapMessage(e) {
          try {
            var data = JSON.parse(e.data);

            if (data.type === 'SYNC') {
              if (data.myLoc) {
                if (!myMarker) {
                  myMarker = L.marker([data.myLoc.latitude, data.myLoc.longitude], {icon: myIcon}).addTo(map);
                  if (!data.partnerLoc) map.setView([data.myLoc.latitude, data.myLoc.longitude], 15);
                } else {
                  myMarker.setLatLng([data.myLoc.latitude, data.myLoc.longitude]);
                }
                if (data.activeTab === 'me' && !data.isNewRoute) {
                  map.panTo([data.myLoc.latitude, data.myLoc.longitude]);
                }
              }

              if (data.partnerLoc) {
                if (!partnerMarker) {
                  partnerMarker = L.marker([data.partnerLoc.latitude, data.partnerLoc.longitude], {icon: partnerIcon}).addTo(map);
                } else {
                  partnerMarker.setLatLng([data.partnerLoc.latitude, data.partnerLoc.longitude]);
                }
                if (data.activeTab === 'partner' && !data.isNewRoute) {
                  map.panTo([data.partnerLoc.latitude, data.partnerLoc.longitude]);
                }
              } else if (partnerMarker) {
                map.removeLayer(partnerMarker);
                partnerMarker = null;
              }

              var activeRoute = null;
              var routeColor = '#45aaf2';
              if (data.activeTab === 'me' && data.tripActive && data.route && data.route.length > 0) {
                activeRoute = data.route;
                routeColor = '#45aaf2';
              } else if (data.activeTab === 'partner' && data.partnerRoute && data.partnerRoute.length > 0) {
                activeRoute = data.partnerRoute;
                routeColor = '#ff6b81';
              }

              if (activeRoute && activeRoute.length > 0) {
                var latlngs = activeRoute.map(function(c) { return [c.latitude, c.longitude]; });
                if (!routeLine) {
                  routeLine = L.polyline(latlngs, {color: routeColor, weight: 4}).addTo(map);
                } else {
                  routeLine.setStyle({color: routeColor});
                  routeLine.setLatLngs(latlngs);
                }

                var destLoc = activeRoute[activeRoute.length - 1];
                if (!destMarker) {
                  destMarker = L.marker([destLoc.latitude, destLoc.longitude], {icon: destIcon}).addTo(map);
                } else {
                  destMarker.setLatLng([destLoc.latitude, destLoc.longitude]);
                }

                if (data.isNewRoute) {
                  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
                }
              } else {
                if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
                if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
              }
            }

            if (data.type === 'RECENTER') {
              map.setView([data.lat, data.lng], 15);
            }
          } catch(err) {}
        }

        document.addEventListener('message', handleMapMessage);
        window.addEventListener('message', handleMapMessage);
      </script>
    </body>
    </html>
  `;

  const fetchSavedPartnerData = useCallback(async () => {
    if (!partnerId) return;
    try {
      const res = await axiosInstance.get('/pairing/partner');
      if (res.data?.location?.lat != null && res.data?.location?.lng != null) {
        setPartnerLocation({
          latitude: res.data.location.lat,
          longitude: res.data.location.lng,
        });
        setPartnerLastUpdated(res.data.location.updatedAt || new Date().toISOString());
      }
      if (res.data?.activeTrip?.active) {
        setPartnerTrip(res.data.activeTrip);
        if (res.data.activeTrip.currentLocation?.lat != null && res.data.activeTrip.currentLocation?.lng != null) {
          setPartnerLocation({
            latitude: res.data.activeTrip.currentLocation.lat,
            longitude: res.data.activeTrip.currentLocation.lng,
          });
        }
        setPartnerLastUpdated(res.data.activeTrip.updatedAt || new Date().toISOString());
      } else {
        setPartnerTrip(null);
      }
    } catch (e) {}
  }, [partnerId]);

  useEffect(() => {
    fetchSavedPartnerData();
  }, [fetchSavedPartnerData]);

  // Sync state to WebView
  useEffect(() => {
    if (webViewRef.current && location) {
      const pRoute = partnerTrip?.active && Array.isArray(partnerTrip.routeCoordinates) ? partnerTrip.routeCoordinates : [];
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'SYNC',
          myLoc: location,
          partnerLoc: partnerLocation,
          activeTab,
          tripActive,
          route: routeCoordinates,
          partnerRoute: pRoute,
          isNewRoute: routeCoordinates.length > 0 && isRouting === false && activeTab === 'me',
        })
      );
    }
  }, [location, partnerLocation, partnerTrip, activeTab, tripActive, routeCoordinates, isRouting]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveLocation = (loc) => {
      setPartnerLocation(loc);
      setPartnerLastUpdated(new Date().toISOString());
    };

    const handleReceivePartnerTrip = (trip) => {
      if (!trip) return;
      setPartnerTrip(trip);
      setPartnerLastUpdated(trip.updatedAt || new Date().toISOString());
      if (trip.currentLocation?.lat != null && trip.currentLocation?.lng != null) {
        setPartnerLocation({
          latitude: trip.currentLocation.lat,
          longitude: trip.currentLocation.lng,
        });
      }
    };

    const handleReceivePartnerTripEnded = () => {
      setPartnerTrip(null);
      Toast.show({ type: 'info', text1: 'Trip Ended', text2: 'Your partner has ended their trip.' });
    };

    socket.on('receive_location', handleReceiveLocation);
    socket.on('receive_partner_trip', handleReceivePartnerTrip);
    socket.on('receive_partner_trip_ended', handleReceivePartnerTripEnded);

    return () => {
      socket.off('receive_location', handleReceiveLocation);
      socket.off('receive_partner_trip', handleReceivePartnerTrip);
      socket.off('receive_partner_trip_ended', handleReceivePartnerTripEnded);
    };
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
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      locationSubscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 4,
        },
        async (loc) => {
          const coords = loc.coords;
          setLocation(coords);
          const currentSpeedVal = coords.speed && coords.speed > 0 ? Number((coords.speed * 3.6).toFixed(1)) : 0;
          setSpeed(currentSpeedVal);

          const now = Date.now();
          if (now - lastGeocodeTimeRef.current > 15000 || !currentAddressRef.current) {
            lastGeocodeTimeRef.current = now;
            const addr = await reverseGeocodeAddress(coords.latitude, coords.longitude);
            currentAddressRef.current = addr;
            setCurrentAddress(addr);
          }

          if ((isSharingLiveRef.current || tripActiveRef.current) && socketRef.current && roomRef.current) {
            socketRef.current.emit('update_location', {
              room: roomRef.current,
              location: { latitude: coords.latitude, longitude: coords.longitude },
            });
          }

          if (tripActiveRef.current && activeTripPayloadRef.current) {
            if (lastGpsCoordRef.current) {
              const delta = haversineMeters(
                lastGpsCoordRef.current.latitude,
                lastGpsCoordRef.current.longitude,
                coords.latitude,
                coords.longitude
              );
              if (delta >= 4 && delta <= 250) {
                coveredMetersRef.current += delta;
                setCoveredMeters(coveredMetersRef.current);
              }
            }
            lastGpsCoordRef.current = { latitude: coords.latitude, longitude: coords.longitude };

            const updatedTrip = {
              ...activeTripPayloadRef.current,
              currentLocation: {
                lat: coords.latitude,
                lng: coords.longitude,
                address: currentAddressRef.current || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
              },
              coveredDistanceMeters: Math.round(coveredMetersRef.current),
              coveredDistance: formatDistance(coveredMetersRef.current),
              speed: currentSpeedVal,
              updatedAt: new Date().toISOString(),
            };
            activeTripPayloadRef.current = updatedTrip;

            if (socketRef.current && roomRef.current) {
              socketRef.current.emit('update_trip', {
                room: roomRef.current,
                trip: updatedTrip,
              });
            }

            if (now - lastTripDbSyncRef.current > 15000) {
              lastTripDbSyncRef.current = now;
              axiosInstance.put('/auth/trip', updatedTrip).catch(() => {});
              axiosInstance
                .put('/auth/location', { latitude: coords.latitude, longitude: coords.longitude })
                .catch(() => {});
            }
          }
        }
      );
    })();

    return () => {
      if (locationSubscriber) {
        locationSubscriber.remove();
      }
    };
  }, [reverseGeocodeAddress]);

  const handleStartTrip = async () => {
    if (!destination.trim() || !location) return;

    setIsRouting(true);
    try {
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination.trim())}&format=json&limit=1`,
        { headers: { 'User-Agent': 'HandSCoupleApp/1.0' } }
      );
      const geocodeData = await geocodeResponse.json();

      if (!geocodeData || geocodeData.length === 0) {
        Toast.show({ type: 'error', text1: 'Not Found', text2: 'Destination not found!' });
        setIsRouting(false);
        return;
      }

      const destLat = parseFloat(geocodeData[0].lat);
      const destLon = parseFloat(geocodeData[0].lon);
      const resolvedDestName = destination.trim();

      const startLon = location.longitude;
      const startLat = location.latitude;

      const selectedVehicleObj = VEHICLE_OPTIONS.find((v) => v.id === vehicleType) || VEHICLE_OPTIONS[0];
      const profile = selectedVehicleObj.osrmProfile || 'driving';

      const osrmResponse = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson`
      );
      const osrmData = await osrmResponse.json();

      if (osrmData.code === 'Ok' && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const polylineCoords = route.geometry.coordinates.map((coord) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        const distKm = (route.distance / 1000).toFixed(1);
        const formattedDist = `${distKm} km`;
        const adjustedMinutes = (route.duration / 60) / (selectedVehicleObj.speedFactor || 1);
        const formattedETA = formatDurationMinutes(adjustedMinutes);
        const startAddr =
          currentAddressRef.current || (await reverseGeocodeAddress(startLat, startLon));
        currentAddressRef.current = startAddr;
        setCurrentAddress(startAddr);

        setRouteCoordinates(polylineCoords);
        setTripDistance(formattedDist);
        setTripTotalMeters(route.distance);
        setTripETA(formattedETA);
        coveredMetersRef.current = 0;
        setCoveredMeters(0);
        lastGpsCoordRef.current = { latitude: startLat, longitude: startLon };
        setTripActive(true);

        const tripPayload = {
          active: true,
          destination: resolvedDestName,
          destinationCoords: { lat: destLat, lng: destLon },
          startLocation: { lat: startLat, lng: startLon, address: startAddr },
          currentLocation: { lat: startLat, lng: startLon, address: startAddr },
          vehicleType,
          totalDistance: formattedDist,
          totalDistanceMeters: Math.round(route.distance),
          coveredDistance: '0 m',
          coveredDistanceMeters: 0,
          eta: formattedETA,
          speed: Number(speed) || 0,
          routeCoordinates: downsampleCoords(polylineCoords, 220),
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        activeTripPayloadRef.current = tripPayload;
        lastTripDbSyncRef.current = Date.now();

        // Persist to DB and share immediately with Partner via Socket.IO
        axiosInstance.put('/auth/trip', tripPayload).catch(() => {});
        axiosInstance.put('/auth/location', { latitude: startLat, longitude: startLon }).catch(() => {});

        if (socketRef.current && roomRef.current) {
          socketRef.current.emit('start_trip', {
            room: roomRef.current,
            partnerId,
            senderId: user?._id,
            senderName: user?.fullName || user?.username,
            trip: tripPayload,
          });
          socketRef.current.emit('update_location', {
            room: roomRef.current,
            location: { latitude: startLat, longitude: startLon },
          });
        }

        Toast.show({
          type: 'success',
          text1: 'Trip Started & Shared! 🚗',
          text2: 'Your partner can now track your live trip in Partner Status.',
        });
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
    setCoveredMeters(0);
    setTripTotalMeters(0);
    coveredMetersRef.current = 0;
    activeTripPayloadRef.current = null;
    lastGpsCoordRef.current = null;

    axiosInstance.put('/auth/trip', { active: false }).catch(() => {});
    if (socketRef.current && roomRef.current) {
      socketRef.current.emit('end_trip', { room: roomRef.current });
    }
    Toast.show({ type: 'info', text1: 'Trip Ended', text2: 'Live trip sharing stopped.' });
  };

  const handleRecenter = () => {
    const targetLoc = activeTab === 'me' ? location : partnerLocation;
    if (targetLoc && webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'RECENTER',
          lat: targetLoc.latitude,
          lng: targetLoc.longitude,
        })
      );
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
        if (webViewRef.current) {
          webViewRef.current.postMessage(
            JSON.stringify({
              type: 'RECENTER',
              lat: currentLoc.coords.latitude,
              lng: currentLoc.coords.longitude,
            })
          );
        }
      } else {
        await fetchSavedPartnerData();
        handleRecenter();
      }
    } catch (e) {
      console.log('Error refreshing location:', e);
    }
  };

  const partnerProgressPercent =
    partnerTrip?.totalDistanceMeters > 0
      ? Math.min(100, Math.round(((partnerTrip.coveredDistanceMeters || 0) / partnerTrip.totalDistanceMeters) * 100))
      : 0;

  const myProgressPercent =
    tripTotalMeters > 0 ? Math.min(100, Math.round((coveredMeters / tripTotalMeters) * 100)) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Live Map</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'me' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('me')}
          >
            <Text style={[styles.tabText, activeTab === 'me' ? { color: theme.colors.primary, fontWeight: 'bold' } : { color: theme.colors.textSecondary }]}>
              My Location
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'partner' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('partner')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.tabText, activeTab === 'partner' ? { color: theme.colors.primary, fontWeight: 'bold' } : { color: theme.colors.textSecondary }]}>
                Partner's Location
              </Text>
              {partnerTrip?.active && <View style={styles.liveDot} />}
            </View>
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
              <WebView
                ref={webViewRef}
                style={styles.map}
                source={{ html: leafletHTML }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                onLoadEnd={() => {
                  if (webViewRef.current && location) {
                    const pRoute =
                      partnerTrip?.active && Array.isArray(partnerTrip.routeCoordinates)
                        ? partnerTrip.routeCoordinates
                        : [];
                    webViewRef.current.postMessage(
                      JSON.stringify({
                        type: 'SYNC',
                        myLoc: location,
                        partnerLoc: partnerLocation,
                        activeTab,
                        tripActive,
                        route: routeCoordinates,
                        partnerRoute: pRoute,
                        isNewRoute: false,
                      })
                    );
                  }
                }}
              />

              {/* Live Speed Badge */}
              <View style={[styles.speedBadge, { backgroundColor: theme.colors.card, shadowColor: theme.colors.text }]}>
                <Text style={[styles.speedValue, { color: theme.colors.text }]}>
                  {activeTab === 'partner' && partnerTrip?.active ? partnerTrip.speed || 0 : speed}
                </Text>
                <Text style={[styles.speedUnit, { color: theme.colors.textSecondary }]}>km/h</Text>
              </View>

              {/* Map Action Buttons */}
              <View style={styles.mapActionsContainer}>
                <TouchableOpacity style={[styles.mapActionButton, { backgroundColor: theme.colors.card }]} onPress={handleRefresh}>
                  <Ionicons name="refresh" size={22} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mapActionButton, { backgroundColor: theme.colors.card, marginTop: 10 }]} onPress={handleRecenter}>
                  <Ionicons name="locate" size={22} color={theme.colors.primary} />
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
                    <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Share Location & Trip</Text>
                    <Ionicons name={isPanelExpanded ? 'chevron-down' : 'chevron-up'} size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>

                  {isPanelExpanded && (
                    <ScrollView
                      style={{ maxHeight: 310, marginTop: 12 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      <View style={styles.shareRow}>
                        <Text style={[styles.shareLabel, { color: theme.colors.textSecondary }]}>Live Tracking</Text>
                        <TouchableOpacity
                          style={[styles.toggleBtn, isSharingLive ? { backgroundColor: '#2bcbba' } : { backgroundColor: theme.colors.border }]}
                          onPress={async () => {
                            const newState = !isSharingLive;
                            setIsSharingLive(newState);
                            try {
                              await AsyncStorage.setItem('isSharingLive', JSON.stringify(newState));
                            } catch (e) {}

                            if (newState) {
                              try {
                                if (location) {
                                  await axiosInstance.put('/auth/location', {
                                    latitude: location.latitude,
                                    longitude: location.longitude,
                                  });
                                }
                                const { status } = await Location.requestBackgroundPermissionsAsync();
                                if (status === 'granted') {
                                  await Location.startLocationUpdatesAsync('background-location-task', {
                                    accuracy: Location.Accuracy.High,
                                    timeInterval: 10000,
                                    distanceInterval: 10,
                                    showsBackgroundLocationIndicator: true,
                                    foregroundService: {
                                      notificationTitle: 'HandS Live Tracking',
                                      notificationBody: 'Sharing your live location with your partner.',
                                      notificationColor: '#ff6b81',
                                    },
                                  });
                                }
                              } catch (e) {
                                console.log('Failed to start bg location', e);
                              }
                              if (socketRef.current && roomRef.current && location) {
                                socketRef.current.emit('update_location', {
                                  room: roomRef.current,
                                  location: { latitude: location.latitude, longitude: location.longitude },
                                });
                              }
                            } else {
                              try {
                                const hasTask = await Location.hasStartedLocationUpdatesAsync('background-location-task');
                                if (hasTask) {
                                  await Location.stopLocationUpdatesAsync('background-location-task');
                                }
                              } catch (e) {}
                            }
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{isSharingLive ? 'ON' : 'OFF'}</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.tripSection}>
                        {tripActive ? (
                          <View style={styles.activeTripCard}>
                            <View style={styles.tripTitleRow}>
                              <Text style={[styles.activeTripTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                Trip to {destination}
                              </Text>
                              <View style={[styles.vehicleBadge, { backgroundColor: 'rgba(255, 107, 129, 0.15)' }]}>
                                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>{vehicleType}</Text>
                              </View>
                            </View>

                            {currentAddress ? (
                              <Text style={[styles.tripSubLocation, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                Current: {currentAddress}
                              </Text>
                            ) : null}

                            <View style={styles.statsGrid}>
                              <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                                <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Distance</Text>
                                <Text style={[styles.statMiniValue, { color: theme.colors.text }]}>{tripDistance}</Text>
                              </View>
                              <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                                <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Est. Time</Text>
                                <Text style={[styles.statMiniValue, { color: theme.colors.text }]}>{tripETA}</Text>
                              </View>
                              <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                                <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Covered</Text>
                                <Text style={[styles.statMiniValue, { color: theme.colors.primary }]}>
                                  {formatDistance(coveredMeters)} ({myProgressPercent}%)
                                </Text>
                              </View>
                              <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                                <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Speed</Text>
                                <Text style={[styles.statMiniValue, { color: theme.colors.text }]}>{speed} km/h</Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={[styles.primaryBtn, { backgroundColor: '#ff4757', marginTop: 12 }]}
                              onPress={handleEndTrip}
                            >
                              <Text style={styles.primaryBtnText}>End Trip</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <>
                            <Text style={[styles.shareLabel, { color: theme.colors.textSecondary, marginBottom: 8 }]}>
                              Share a Trip (Live with Partner)
                            </Text>

                            <View style={styles.vehicleRow}>
                              {VEHICLE_OPTIONS.map((v) => {
                                const selected = vehicleType === v.id;
                                return (
                                  <TouchableOpacity
                                    key={v.id}
                                    style={[
                                      styles.vehicleChip,
                                      {
                                        backgroundColor: selected ? theme.colors.primary : theme.colors.inputBackground,
                                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                                      },
                                    ]}
                                    onPress={() => setVehicleType(v.id)}
                                  >
                                    <Ionicons name={v.icon} size={15} color={selected ? '#fff' : theme.colors.text} />
                                    <Text style={{ color: selected ? '#fff' : theme.colors.text, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                                      {v.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

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
                                <Text style={styles.primaryBtnText}>Start & Share Trip</Text>
                              )}
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </ScrollView>
                  )}
                </View>
              )}

              {activeTab === 'partner' && (
                <View style={[styles.bottomPanel, { backgroundColor: theme.colors.card }]}>
                  <TouchableOpacity
                    style={styles.panelHeader}
                    onPress={() => setIsPanelExpanded(!isPanelExpanded)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Partner Status</Text>
                      {partnerTrip?.active && (
                        <View style={styles.liveTripPill}>
                          <Text style={styles.liveTripPillText}>ON TRIP</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name={isPanelExpanded ? 'chevron-down' : 'chevron-up'} size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>

                  {isPanelExpanded && (
                    <ScrollView style={{ maxHeight: 320, marginTop: 12 }} showsVerticalScrollIndicator={false}>
                      {partnerTrip?.active ? (
                        <View>
                          <View style={[styles.tripDetailCard, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
                            <View style={styles.detailRow}>
                              <Ionicons name="flag" size={18} color="#2bcbba" />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Destination</Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>{partnerTrip.destination || 'Unknown'}</Text>
                              </View>
                              <View style={[styles.vehicleBadge, { backgroundColor: 'rgba(255, 107, 129, 0.16)' }]}>
                                <Text style={{ color: theme.colors.primary, fontWeight: '700', fontSize: 12 }}>
                                  {partnerTrip.vehicleType || 'Car'}
                                </Text>
                              </View>
                            </View>

                            <View style={[styles.detailRow, { marginTop: 10 }]}>
                              <Ionicons name="navigate" size={18} color="#45aaf2" />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Current / Real-Time Location</Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                  {partnerTrip.currentLocation?.address ||
                                    (partnerLocation
                                      ? `${partnerLocation.latitude.toFixed(4)}, ${partnerLocation.longitude.toFixed(4)}`
                                      : 'Locating...')}
                                </Text>
                                {partnerTrip.currentLocation?.lat != null && (
                                  <Text style={[styles.coordsText, { color: theme.colors.textSecondary }]}>
                                    GPS: {Number(partnerTrip.currentLocation.lat).toFixed(5)}, {Number(partnerTrip.currentLocation.lng).toFixed(5)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>

                          <View style={styles.statsGrid}>
                            <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                              <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Est. Time</Text>
                              <Text style={[styles.statMiniValue, { color: theme.colors.text }]}>{partnerTrip.eta || '--'}</Text>
                            </View>
                            <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                              <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Total Distance</Text>
                              <Text style={[styles.statMiniValue, { color: theme.colors.text }]}>{partnerTrip.totalDistance || '--'}</Text>
                            </View>
                            <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                              <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Real-Time Speed</Text>
                              <Text style={[styles.statMiniValue, { color: '#45aaf2' }]}>{partnerTrip.speed || 0} km/h</Text>
                            </View>
                            <View style={[styles.statMiniBox, { backgroundColor: theme.colors.inputBackground }]}>
                              <Text style={[styles.statMiniLabel, { color: theme.colors.textSecondary }]}>Covered Trip</Text>
                              <Text style={[styles.statMiniValue, { color: '#2bcbba' }]}>
                                {partnerTrip.coveredDistance || '0 m'} ({partnerProgressPercent}%)
                              </Text>
                            </View>
                          </View>

                          <View style={styles.progressSection}>
                            <View style={[styles.progressBg, { backgroundColor: theme.colors.border }]}>
                              <View style={[styles.progressFill, { width: `${partnerProgressPercent}%`, backgroundColor: theme.colors.primary }]} />
                            </View>
                            <Text style={[styles.updatedFoot, { color: theme.colors.textSecondary }]}>
                              Updated: {partnerLastUpdated ? new Date(partnerLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                            </Text>
                          </View>
                        </View>
                      ) : partnerLocation ? (
                        <View style={styles.statusRow}>
                          <Ionicons name="location" size={24} color="#45aaf2" />
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={[styles.statusMainText, { color: theme.colors.text }]}>Live Tracking Enabled</Text>
                            <Text style={[styles.statusSubText, { color: theme.colors.textSecondary }]}>
                              GPS: {partnerLocation.latitude.toFixed(5)}, {partnerLocation.longitude.toFixed(5)}
                            </Text>
                            <Text style={[styles.statusSubText, { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 }]}>
                              No active trip right now • Last updated: {partnerLastUpdated ? new Date(partnerLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.statusRow}>
                          <Ionicons name="location-outline" size={24} color={theme.colors.textSecondary} />
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={[styles.statusMainText, { color: theme.colors.text }]}>Location Not Available</Text>
                            <Text style={[styles.statusSubText, { color: theme.colors.textSecondary }]}>
                              Your partner is not sharing their live location or trip right now.
                            </Text>
                          </View>
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 5,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorText: { fontSize: 16, fontWeight: '500' },
  loadingText: { marginTop: 12, fontSize: 15, fontWeight: '500' },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 15 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2bcbba',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  shareLabel: { fontSize: 15, fontWeight: '600' },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tripSection: { marginTop: 4 },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 10,
  },
  vehicleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    borderRadius: 12,
    padding: 13,
    marginBottom: 10,
    fontSize: 15,
  },
  primaryBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusMainText: { fontSize: 16, fontWeight: '700' },
  statusSubText: { fontSize: 13, marginTop: 2 },
  speedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  speedValue: { fontSize: 20, fontWeight: '800' },
  speedUnit: { fontSize: 10, fontWeight: '600', marginTop: -2 },
  mapActionsContainer: {
    position: 'absolute',
    top: 76,
    right: 16,
    alignItems: 'center',
  },
  mapActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  activeTripCard: { marginTop: 4 },
  tripTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeTripTitle: { fontSize: 17, fontWeight: '800', flex: 1, marginRight: 8 },
  tripSubLocation: { fontSize: 12, marginBottom: 10 },
  vehicleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveTripPill: {
    backgroundColor: '#2bcbba',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveTripPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  tripDetailCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  coordsText: {
    fontSize: 11,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  statMiniBox: {
    width: '48%',
    borderRadius: 12,
    padding: 10,
  },
  statMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statMiniValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  progressSection: {
    marginTop: 10,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  updatedFoot: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
});
