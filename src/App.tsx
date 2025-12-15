import React, { useEffect } from 'react';
import { LogBox, StatusBar, View, Text, Animated, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import AppNavigator from './navigation/AppNavigator';
import { Colors } from './theme/colors';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { localNotificationService } from './services/LocalNotificationService';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Custom Online Toast
const OnlineToast = (props: any) => (
  <View style={styles.onlineToastContainer}>
    <View style={styles.onlineBadge} />
    <View style={{ flex: 1 }}>
      <Text style={styles.onlineToastText}>{props.text1}</Text>
    </View>
  </View>
);

// Toast config matching Kotlin SnackBar style
const toastConfig = {
  online: OnlineToast,
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#4CAF50',
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        marginHorizontal: 16,
      }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      text1Style={{
        fontSize: 14,
        fontWeight: '500',
        color: '#FFFFFF',
      }}
      text2Style={{
        fontSize: 12,
        color: '#B0B0B0',
      }}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#E6002A',
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        marginHorizontal: 16,
      }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      text1Style={{
        fontSize: 14,
        fontWeight: '500',
        color: '#FFFFFF',
      }}
      text2Style={{
        fontSize: 12,
        color: '#B0B0B0',
      }}
    />
  ),
  info: (props: any) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#2196F3',
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        marginHorizontal: 16,
      }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      text1Style={{
        fontSize: 14,
        fontWeight: '500',
        color: '#FFFFFF',
      }}
      text2Style={{
        fontSize: 12,
        color: '#B0B0B0',
      }}
    />
  ),
};

const AppContent = () => {
  const { isDark, colors } = useTheme();
  
  // Initialize local notifications (Notifee - works without Apple Developer account!)
  useEffect(() => {
    localNotificationService.initialize().catch((error) => {
      console.log('📱 App: Local notification initialization error:', error);
    });
  }, []);
  
  // Initialize background notifications for when app is minimized/closed
  useEffect(() => {
    import('./services/BackgroundNotificationService').then((module) => {
      module.default.initialize().catch((error) => {
        console.log('📱 App: Background notification initialization error:', error);
      });
    });
  }, []);
  
  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? colors.surface : Colors.primary}
      />
      <AppNavigator />
    </>
  );
};

const styles = StyleSheet.create({
  onlineToastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  onlineToastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  onlineBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },
});

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
          <Toast config={toastConfig} position="bottom" bottomOffset={40} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
