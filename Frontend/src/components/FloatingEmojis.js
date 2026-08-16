import React, { useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, Easing } from 'react-native';

const { width, height } = Dimensions.get('window');
const EMOJI_COUNT = 25;

export default function FloatingEmojis({ emoji, text }) {
  const [emojis, setEmojis] = useState([]);

  useEffect(() => {
    // Generate emojis with random initial positions and animations
    const newEmojis = Array.from({ length: EMOJI_COUNT }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      size: Math.random() * 20 + 35, // 35 to 55
      translateY: new Animated.Value(height),
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(Math.random() * width),
    }));

    setEmojis(newEmojis);

    newEmojis.forEach((e) => {
      // Randomize animation duration and delay
      const duration = Math.random() * 4000 + 4000; // 4 to 8 seconds
      const delay = Math.random() * 1500;
      
      const swayAmount = Math.random() * 50 + 30; // 30 to 80 sway

      Animated.parallel([
        Animated.timing(e.translateY, {
          toValue: -150, // Move well above screen
          duration: duration,
          delay: delay,
          easing: Easing.out(Easing.ease), // Smooth deceleration
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(e.opacity, {
            toValue: 1,
            duration: 800,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(e.opacity, {
            toValue: 0,
            duration: duration - 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Continuous smooth swaying back and forth
      Animated.loop(
        Animated.sequence([
          Animated.timing(e.translateX, {
            toValue: e.x + swayAmount,
            duration: 1500 + Math.random() * 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(e.translateX, {
            toValue: e.x - swayAmount,
            duration: 3000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(e.translateX, {
            toValue: e.x,
            duration: 1500 + Math.random() * 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, [emoji, text]);

  return (
    <View style={styles.container} pointerEvents="none">
      {emojis.map((e) => (
        <Animated.View
          key={e.id}
          style={[
            styles.emojiContainer,
            {
              transform: [{ translateY: e.translateY }, { translateX: e.translateX }],
              opacity: e.opacity,
            },
          ]}
        >
          <Text
            style={[
              styles.emoji,
              {
                fontSize: e.size,
                lineHeight: e.size * 1.5, // Prevents emoji from being cut off vertically
              },
            ]}
          >
            {emoji}
          </Text>
          {text ? <Text style={[styles.floatingText, { fontSize: Math.max(12, e.size * 0.35) }]}>{text}</Text> : null}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  emojiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    padding: 10,
  },
  floatingText: {
    color: '#ff6b81',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: -8,
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
