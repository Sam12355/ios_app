import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { Colors, FontSizes } from '../../theme/colors';

const SplashScreen = () => {
  const { colors } = useTheme();
  const { checkAuth, isAuthenticated } = useAuthStore();
  const navigation = useNavigation();

  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
    };
    initAuth();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        <View style={[styles.iconContainer, { backgroundColor: Colors.primary }]}>
          <Icon name="store" size={60} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: Colors.primary }]}>Stock Nexus</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Inventory Management System
        </Text>
      </View>
      
      <ActivityIndicator 
        size="large" 
        color={Colors.primary} 
        style={styles.loader}
      />
      
      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
        Loading...
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: FontSizes.md,
    marginTop: 8,
  },
  loader: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: FontSizes.md,
  },
});

export default SplashScreen;
