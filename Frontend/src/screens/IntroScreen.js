import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';

export default function IntroScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      
      {/* 3D App Icon / Illustration Area */}
      <View style={styles.illustrationContainer}>
        <View style={styles.outer3D}>
          <View style={styles.inner3D}>
            {/* We use Lottie or Image here. For now just stylized text to look 3D */}
            <Text style={styles.logoText3D}>H&S</Text>
          </View>
        </View>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Connect deeply.</Text>
        <Text style={styles.subtitle}>
          A private, premium space just for you and your partner. Share moments, live maps, and memories.
        </Text>

        {/* 3D Button */}
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={() => navigation.navigate('Login')}
          style={styles.buttonOuter3D}
        >
          <View style={styles.buttonInner3D}>
            <Text style={styles.buttonText}>Get Started</Text>
          </View>
        </TouchableOpacity>

        {/* Footer Links */}
        <View style={styles.footerLinksRow}>
          <TouchableOpacity onPress={() => navigation.navigate('About')} style={styles.pillOuter3D}>
            <View style={styles.pillInner3D}>
               <Text style={styles.footerLinkText}>About Us</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Policy')} style={styles.pillOuter3D}>
            <View style={styles.pillInner3D}>
               <Text style={styles.footerLinkText}>Privacy</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Soft grayish-white background is crucial for 3D Neumorphism
    backgroundColor: '#E6E9EF', 
  },
  illustrationContainer: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outer3D: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E6E9EF',
    // Dark shadow (bottom right)
    shadowColor: '#b3b9c5',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner3D: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#E6E9EF',
    // Light shadow (top left)
    shadowColor: '#ffffff',
    shadowOffset: { width: -10, height: -10 },
    shadowOpacity: 1,
    shadowRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  logoText3D: {
    fontSize: 54,
    fontWeight: '900',
    color: '#ff6b81',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    fontWeight: '500'
  },
  buttonOuter3D: {
    borderRadius: 30,
    backgroundColor: '#ff6b81',
    // Dark red shadow
    shadowColor: '#d63031',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    marginHorizontal: 20,
  },
  buttonInner3D: {
    borderRadius: 30,
    backgroundColor: '#ff6b81',
    // White top-left highlight for the button
    shadowColor: '#ff9ff3',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footerLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    gap: 20,
  },
  pillOuter3D: {
    borderRadius: 20,
    backgroundColor: '#E6E9EF',
    shadowColor: '#b3b9c5',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 4,
  },
  pillInner3D: {
    borderRadius: 20,
    backgroundColor: '#E6E9EF',
    shadowColor: '#ffffff',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  footerLinkText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '700',
  }
});
