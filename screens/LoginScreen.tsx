import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import type { AuthFormMode } from '../types/auth';

function AuthToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function LoginScreen(): React.JSX.Element {
  const { signIn, signUp, isConfigured, configurationMessage } = useAuth();
  const [mode, setMode] = useState<AuthFormMode>('sign-in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setStatusMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedName = fullName.trim();

    if (!normalizedEmail || !trimmedPassword || (mode === 'sign-up' && !trimmedName)) {
      setStatusMessage('Fill in all required fields before continuing.');
      return;
    }

    if (!isConfigured) {
      setStatusMessage(configurationMessage ?? 'Supabase is not configured yet.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await signIn(normalizedEmail, trimmedPassword);
      } else {
        await signUp(trimmedName, normalizedEmail, trimmedPassword);
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Authentication failed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <View style={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>HR</Text>
          </View>
          <Text style={styles.title}>HealthRec</Text>
          <Text style={styles.subtitle}>
            Sign in with your HealthRec account to keep your health data private to
            your profile on this device and in Supabase.
          </Text>

          <View style={styles.toggleRow}>
            <AuthToggle
              label="Login"
              active={mode === 'sign-in'}
              onPress={() => setMode('sign-in')}
            />
            <AuthToggle
              label="Create Account"
              active={mode === 'sign-up'}
              onPress={() => setMode('sign-up')}
            />
          </View>

          {mode === 'sign-up' ? (
            <>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. Aarav Sharma"
                placeholderTextColor="#97A4BA"
                style={styles.input}
                autoCapitalize="words"
              />
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#97A4BA"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#97A4BA"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.featureList}>
            <Text style={styles.featureItem}>- Each account only sees its own local data</Text>
            <Text style={styles.featureItem}>- Existing device data is claimed by the first real account</Text>
            <Text style={styles.featureItem}>- Logout clears session state, not your stored health history</Text>
          </View>

          <Pressable
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {mode === 'sign-in' ? 'Login' : 'Create Account'}
            </Text>
          </Pressable>

          <Text style={styles.footnote}>
            {configurationMessage ??
              'Email/password auth uses Supabase Auth and persists your session locally.'}
          </Text>
          {statusMessage ? <Text style={styles.errorText}>{statusMessage}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FF',
  },
  backgroundGlowTop: {
    position: 'absolute',
    top: -80,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: '#DCEBFF',
  },
  backgroundGlowBottom: {
    position: 'absolute',
    bottom: -110,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: '#E8FFF7',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0A1F44',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 3,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  logoBadgeText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  title: {
    marginTop: 18,
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  toggleButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  toggleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.primary,
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FBFCFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  featureList: {
    marginTop: 22,
    gap: 10,
  },
  featureItem: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: 26,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footnote: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
});
