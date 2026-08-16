import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const heartY = useRef(new Animated.Value(500)).current; // Start 500px below center (offscreen)
  const titleOp = useRef(new Animated.Value(0)).current;
  const subtitleOp = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Heart floats up from bottom to mid screen
      Animated.timing(heartY, {
        toValue: -50, // Slightly above center so text fits perfectly below
        duration: 1000,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      // 2. Title "H & S" appears
      Animated.timing(titleOp, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // 3. Subtitle "Production with ♥️" appears
      Animated.timing(subtitleOp, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // Wait a bit to let user read
      Animated.delay(1000),
      // 4. Both texts disappear
      Animated.parallel([
        Animated.timing(titleOp, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOp, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // 5. Heart scales up huge to fill the screen
      Animated.timing(heartScale, {
        toValue: 100, // Very large scale
        duration: 800,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // 6. Transition to next screen only if animation finished naturally
      if (finished && onFinish) {
        onFinish();
      }
    });
  }, []); // Empty dependency array prevents re-running if parent re-renders

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.heartContainer, 
          { transform: [{ translateY: heartY }, { scale: heartScale }] }
        ]}
      >
        <Text style={styles.heart}>❤️</Text>
      </Animated.View>

      <Animated.View style={[styles.titleContainer, { opacity: titleOp }]}>
        <Text style={styles.title}>H & S</Text>
      </Animated.View>

      <Animated.View style={[styles.subtitleContainer, { opacity: subtitleOp }]}>
        <Text style={styles.subtitle}>Your Private World</Text>
      </Animated.View>

      <Animated.View style={[styles.footerContainer, { opacity: subtitleOp }]}>
        <Text style={styles.footerText}>Production with ❤️</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 1, // Ensures heart scales over everything
  },
  heart: {
    fontSize: 120,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  titleContainer: {
    position: 'absolute',
    top: height / 2 + 60, // Added more spacing above text
    alignItems: 'center',
    zIndex: 0,
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    color: '#ff6b81',
    letterSpacing: 3,
  },
  subtitleContainer: {
    position: 'absolute',
    top: height / 2 + 130, // Added more spacing between texts
    alignItems: 'center',
    zIndex: 0,
  },
  subtitle: {
    fontSize: 18,
    color: '#888',
    letterSpacing: 2,
    fontWeight: '500',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 40, // Placed at the end of the screen like a footer
    alignItems: 'center',
    zIndex: 0,
  },
  footerText: {
    fontSize: 14,
    color: '#aaa',
    letterSpacing: 1,
    fontWeight: '400',
  },
});
