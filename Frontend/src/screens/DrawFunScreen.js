import React, { useState, useRef } from 'react';
import { 
  View, StyleSheet, TouchableOpacity, Text, 
  PanResponder, Dimensions, Image, ActivityIndicator, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../context/ThemeContext';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from '../api/axiosConfig';
import Toast from 'react-native-toast-message';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import DraggableItem from '../components/DraggableItem';
const { width, height } = Dimensions.get('window');
const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FFFFFF', '#000000'];
const STROKES = [2, 5, 10, 20];
const STICKERS = ['❤️', '😂', '🔥', '✨', '🥺', '🎉', '🌟', '🍿'];

export default function DrawFunScreen() {
  const { theme } = useThemeContext();
  const navigation = useNavigation();
  const viewShotRef = useRef(null);

  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(5);
  
  const [bgImage, setBgImage] = useState(null);
  const [placedElements, setPlacedElements] = useState([]);
  
  const [showTools, setShowTools] = useState(false);
  const [toolMode, setToolMode] = useState('draw'); // 'draw', 'color', 'stroke', 'sticker', 'shape', 'text'
  const [isPosting, setIsPosting] = useState(false);
  const [textInput, setTextInput] = useState('');

  const handlePanResponderGrant = (evt) => {
    if (toolMode !== 'draw') return;
    const { locationX, locationY } = evt.nativeEvent;
    setCurrentPath({
      path: `M${locationX},${locationY}`,
      color,
      strokeWidth
    });
  };

  const handlePanResponderMove = (evt) => {
    if (toolMode !== 'draw' || !currentPath) return;
    const { locationX, locationY } = evt.nativeEvent;
    setCurrentPath((prev) => ({
      ...prev,
      path: `${prev.path} L${locationX},${locationY}`
    }));
  };

  const handlePanResponderRelease = () => {
    if (currentPath) {
      setPaths([...paths, currentPath]);
      setCurrentPath(null);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handlePanResponderGrant,
      onPanResponderMove: handlePanResponderMove,
      onPanResponderRelease: handlePanResponderRelease,
    })
  ).current;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setBgImage(result.assets[0].uri);
    }
  };

  const addSticker = (sticker) => {
    setPlacedElements([...placedElements, { type: 'sticker', content: sticker, x: width/2 - 20, y: height/3 }]);
    setShowTools(false);
    setToolMode('draw');
  };

  const addText = () => {
    if (textInput.trim()) {
      setPlacedElements([...placedElements, { type: 'text', content: textInput, x: width/2 - 40, y: height/3, color }]);
      setTextInput('');
      setShowTools(false);
      setToolMode('draw');
    }
  };

  const addShape = (shape) => {
    setPlacedElements([...placedElements, { type: 'shape', shape, color, x: width/2 - 50, y: height/3 }]);
    setShowTools(false);
    setToolMode('draw');
  };

  const undo = () => {
    if (paths.length > 0) {
      setPaths(paths.slice(0, -1));
    } else if (placedElements.length > 0) {
      setPlacedElements(placedElements.slice(0, -1));
    }
  };

  const handlePost = async () => {
    if (paths.length === 0 && placedElements.length === 0 && !bgImage) {
      Toast.show({ type: 'info', text1: 'Empty canvas', text2: 'Draw something first!' });
      return;
    }

    setIsPosting(true);
    try {
      const uri = await viewShotRef.current.capture();
      
      const formData = new FormData();
      formData.append('media', {
        uri,
        name: `drawing_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });

      const uploadRes = await axiosInstance.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const mediaUrl = uploadRes.data;

      await axiosInstance.post('/posts', {
        content: 'Check out my drawing! 🎨',
        mediaUrl,
        mediaType: 'drawing'
      });

      Toast.show({ type: 'success', text1: 'Sent!', text2: 'Your partner has been notified.' });
      navigation.goBack();
    } catch (error) {
      console.log('Error posting drawing:', error);
      Toast.show({ type: 'error', text1: 'Failed to post', text2: 'Please try again later' });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { zIndex: 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePost} style={styles.postBtn} disabled={isPosting}>
          {isPosting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postText}>Post</Text>}
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <ViewShot ref={viewShotRef} style={styles.viewShot} options={{ format: 'jpg', quality: 0.9 }}>
          <View style={styles.canvasBackground} {...panResponder.panHandlers}>
            {bgImage && <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            
            <Svg style={StyleSheet.absoluteFill}>
              {paths.map((p, i) => (
                <Path key={i} d={p.path} stroke={p.color} strokeWidth={p.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              ))}
              {currentPath && (
                <Path d={currentPath.path} stroke={currentPath.color} strokeWidth={currentPath.strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              )}
            </Svg>

            {placedElements.map((el, i) => {
              if (el.type === 'sticker') {
                return (
                  <DraggableItem key={i} initialX={el.x} initialY={el.y}>
                    <Text style={{ fontSize: 50 }}>{el.content}</Text>
                  </DraggableItem>
                );
              }
              if (el.type === 'text') {
                return (
                  <DraggableItem key={i} initialX={el.x} initialY={el.y}>
                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: el.color }}>{el.content}</Text>
                  </DraggableItem>
                );
              }
              if (el.type === 'shape') {
                return (
                  <DraggableItem key={i} initialX={el.x} initialY={el.y}>
                    <Svg height="100" width="100">
                      {el.shape === 'rect' && <Rect width="100" height="100" fill={el.color} />}
                      {el.shape === 'circle' && <Circle cx="50" cy="50" r="50" fill={el.color} />}
                    </Svg>
                  </DraggableItem>
                );
              }
              return null;
            })}
          </View>
        </ViewShot>
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.cardBg }]}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('color'); setShowTools(true); }}>
          <View style={[styles.colorPreview, { backgroundColor: color }]} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('stroke'); setShowTools(true); }}>
          <Ionicons name="pencil" size={24} color={toolMode === 'draw' ? theme.colors.primary : theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('sticker'); setShowTools(true); }}>
          <Ionicons name="happy-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('text'); setShowTools(true); }}>
          <Ionicons name="text-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setToolMode('shape'); setShowTools(true); }}>
          <Ionicons name="shapes-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={() => {
          setColor('#ffffff');
          setStrokeWidth(20);
          setToolMode('draw');
          Toast.show({ type: 'info', text1: 'Eraser active', text2: 'Draw to erase (white color)' });
        }}>
          <Ionicons name="scan-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.toolBtn} onPress={undo}>
          <Ionicons name="arrow-undo-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tools Panel */}
      {showTools && (
        <Animated.View entering={SlideInDown} style={[styles.toolsPanel, { backgroundColor: theme.colors.cardBg, shadowColor: theme.colors.text }]}>
          <View style={styles.toolsPanelHeader}>
            <Text style={{ color: theme.colors.text, fontWeight: 'bold' }}>
              {toolMode === 'color' && 'Select Color'}
              {toolMode === 'stroke' && 'Pen Thickness'}
              {toolMode === 'sticker' && 'Add Sticker'}
              {toolMode === 'shape' && 'Add Shape'}
            </Text>
            <TouchableOpacity onPress={() => { setShowTools(false); setToolMode('draw'); }}>
              <Ionicons name="close-circle" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.toolsContent}>
            {toolMode === 'color' && COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => { setColor(c); setShowTools(false); setToolMode('draw'); }} style={[styles.colorCircle, { backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: theme.colors.text }]} />
            ))}

            {toolMode === 'stroke' && STROKES.map(s => (
              <TouchableOpacity key={s} onPress={() => { setStrokeWidth(s); setShowTools(false); setToolMode('draw'); }} style={styles.strokeBtn}>
                <View style={{ width: 40, height: s, backgroundColor: theme.colors.text, borderRadius: s/2 }} />
              </TouchableOpacity>
            ))}

            {toolMode === 'sticker' && STICKERS.map(s => (
              <TouchableOpacity key={s} onPress={() => addSticker(s)} style={styles.stickerBtn}>
                <Text style={{ fontSize: 32 }}>{s}</Text>
              </TouchableOpacity>
            ))}

            {toolMode === 'text' && (
              <View style={{ width: '100%', paddingHorizontal: 20 }}>
                <TextInput
                  style={[styles.textInputStyle, { borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter text..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={textInput}
                  onChangeText={setTextInput}
                  autoFocus
                />
                <TouchableOpacity onPress={addText} style={[styles.addTextBtn, { backgroundColor: theme.colors.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Text</Text>
                </TouchableOpacity>
              </View>
            )}

            {toolMode === 'shape' && (
              <>
                <TouchableOpacity onPress={() => addShape('rect')} style={styles.shapeBtn}>
                  <View style={{ width: 40, height: 40, backgroundColor: color }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => addShape('circle')} style={styles.shapeBtn}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color }} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
    top: 50,
    width: '100%'
  },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20
  },
  postBtn: {
    backgroundColor: '#ff6b81',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#ff6b81',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  postText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  canvasContainer: {
    flex: 1,
  },
  viewShot: {
    flex: 1,
  },
  canvasBackground: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  toolBtn: {
    padding: 10,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333'
  },
  toolsPanel: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    right: 10,
    borderRadius: 20,
    padding: 15,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  toolsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  toolsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    justifyContent: 'center'
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  strokeBtn: {
    padding: 10,
    justifyContent: 'center',
  },
  stickerBtn: {
    padding: 5,
  },
  shapeBtn: {
    padding: 10,
  },
  textInputStyle: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  addTextBtn: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  }
});
