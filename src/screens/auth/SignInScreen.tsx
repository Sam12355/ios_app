import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type SignInNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

// Design System Colors - Matching Android app exactly
const colors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardBackground: '#2D2D2D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  inputBorder: '#4D4D4D',
};

const SignInScreen = () => {
  const navigation = useNavigation<SignInNavigationProp>();
  const { signIn, isLoading, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Validation
  const isEmailValid = email.includes('@');
  const isFormValid = email.trim().length > 0 && password.trim().length > 0 && isEmailValid;

  const handleSignIn = async () => {
    if (!isFormValid) {
      Alert.alert('Error', 'Please enter a valid email and password');
      return;
    }

    clearError();

    try {
      await signIn({ email: email.trim(), password });
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Red Status Bar Area */}
      <View style={styles.statusBarArea} />
      
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* App Logo */}
          <View style={styles.logoSection}>
            <Icon name="store" size={48} color={colors.primaryRed} />
            <Text style={styles.logoText}>IMS</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerSection}>
              <Text style={styles.welcomeText}>Welcome Back</Text>
              <Text style={styles.subtitleText}>
                Sign in to access your inventory{'\n'}management system
              </Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Icon name="mail-outline" size={22} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Icon name="lock-outline" size={22} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Icon
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={22}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.rememberForgotRow}>
              <TouchableOpacity 
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Icon name="check" size={14} color={colors.textPrimary} />}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => {/* TODO: Forgot password */}}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.signInButton,
                (!isFormValid || isLoading) && styles.signInButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={isLoading}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  statusBarArea: {
    height: Platform.OS === 'ios' ? 44 : 0,
    backgroundColor: colors.primaryRed,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primaryRed,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: colors.textPrimary,
  },
  eyeIcon: {
    padding: 4,
  },
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primaryRed,
    borderColor: colors.primaryRed,
  },
  rememberMeText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primaryRed,
    textDecorationLine: 'underline',
  },
  signInButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.7,
  },
  signInButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryRed,
  },
});

export default SignInScreen;
