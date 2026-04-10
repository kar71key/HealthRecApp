import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { useHealthData } from '../context/HealthDataContext';
import { colors } from '../theme/colors';

type ScreenShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function ScreenShell({
  title,
  subtitle,
  children,
}: ScreenShellProps): React.JSX.Element {
  const { user, logout, isLoggedIn } = useAuth();
  const {
    profile,
    saveProfile,
    pendingSyncCount,
    syncError,
    syncNow,
    syncState,
    lastSyncedAt,
  } = useHealthData();
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [ageDraft, setAgeDraft] = useState('');
  const [heightDraft, setHeightDraft] = useState('');
  const [weightDraft, setWeightDraft] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [profileMessage, setProfileMessage] = useState('');

  const openProfile = () => {
    setAgeDraft(profile?.age ? `${profile.age}` : '');
    setHeightDraft(profile?.heightCm ? `${profile.heightCm}` : '');
    setWeightDraft(profile?.weightKg ? `${profile.weightKg}` : '');
    setGoalDraft(profile?.goal ?? '');
    setProfileMessage('');
    setIsProfileVisible(true);
  };

  const syncLabel =
    syncState === 'syncing'
      ? 'Syncing your account...'
      : syncState === 'offline'
        ? `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting for connection`
        : syncState === 'error'
          ? syncError || 'Sync failed and will retry'
          : lastSyncedAt
            ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : pendingSyncCount > 0
              ? `${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} waiting to sync`
              : 'Ready to sync';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {isLoggedIn ? (
                <View style={styles.syncRow}>
                  <View
                    style={[
                      styles.syncBadge,
                      syncState === 'error'
                        ? styles.syncBadgeError
                        : syncState === 'offline'
                          ? styles.syncBadgeOffline
                          : styles.syncBadgeIdle,
                    ]}
                  >
                    <Text style={styles.syncBadgeText}>{syncLabel}</Text>
                  </View>
                  <Pressable style={styles.syncAction} onPress={syncNow}>
                    <Text style={styles.syncActionText}>Sync now</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            {isLoggedIn && user ? (
              <Pressable
                style={styles.profileButton}
                onPress={openProfile}
              >
                <Text style={styles.profileButtonText}>{user.avatarLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {children}
      </ScrollView>
      <Modal
        visible={isProfileVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsProfileVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{user?.avatarLabel ?? 'U'}</Text>
              </View>
              <Pressable onPress={() => setIsProfileVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.profileName}>{user?.fullName ?? 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            <View style={styles.profileStatGrid}>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Age</Text>
                <TextInput
                  value={ageDraft}
                  onChangeText={setAgeDraft}
                  keyboardType="number-pad"
                  placeholder="29"
                  placeholderTextColor="#97A4BA"
                  style={styles.profileInput}
                />
              </View>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Height (cm)</Text>
                <TextInput
                  value={heightDraft}
                  onChangeText={setHeightDraft}
                  keyboardType="decimal-pad"
                  placeholder="175"
                  placeholderTextColor="#97A4BA"
                  style={styles.profileInput}
                />
              </View>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Weight (kg)</Text>
                <TextInput
                  value={weightDraft}
                  onChangeText={setWeightDraft}
                  keyboardType="decimal-pad"
                  placeholder="70"
                  placeholderTextColor="#97A4BA"
                  style={styles.profileInput}
                />
              </View>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Goal</Text>
                <TextInput
                  value={goalDraft}
                  onChangeText={setGoalDraft}
                  placeholder="Improve sleep consistency"
                  placeholderTextColor="#97A4BA"
                  multiline
                  style={[styles.profileInput, styles.goalInput]}
                />
              </View>
            </View>

            <Pressable
              style={styles.saveProfileButton}
              onPress={async () => {
                await saveProfile({
                  age: ageDraft ? Number(ageDraft) : null,
                  heightCm: heightDraft ? Number(heightDraft) : null,
                  weightKg: weightDraft ? Number(weightDraft) : null,
                  goal: goalDraft.trim() || null,
                });
                setProfileMessage('Profile saved. Account sync status updated above.');
              }}
            >
              <Text style={styles.saveProfileButtonText}>Save Profile</Text>
            </Pressable>

            {profileMessage ? (
              <Text style={styles.profileMessage}>{profileMessage}</Text>
            ) : null}

            <Pressable
              style={styles.logoutButton}
              onPress={async () => {
                setIsProfileVisible(false);
                await logout();
              }}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    marginTop: 8,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  syncRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  syncBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncBadgeIdle: {
    backgroundColor: colors.primaryMuted,
    borderColor: '#C7D9F7',
  },
  syncBadgeOffline: {
    backgroundColor: '#FFF4DF',
    borderColor: '#FFD79A',
  },
  syncBadgeError: {
    backgroundColor: '#FDEDED',
    borderColor: '#F4B7B7',
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  syncAction: {
    paddingVertical: 4,
  },
  syncActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  profileButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(16,33,58,0.24)',
  },
  profileCard: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  profileName: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileEmail: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  profileStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  profileStatCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  profileStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  profileStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FBFCFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },
  goalInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  profileGoalText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  saveProfileButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveProfileButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileMessage: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  logoutButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
