import React from 'react';
import { LogBox, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import AppNavigator from './navigation/AppNavigator';
import { Colors } from './theme/colors';
import { ThemeProvider, useTheme } from './theme/ThemeContext';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Toast config matching Kotlin SnackBar style
const toastConfig = {
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
  const { isDark } = useTheme();
  
  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={Colors.primary}
      />
      <AppNavigator />
    </>
  );
};

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
