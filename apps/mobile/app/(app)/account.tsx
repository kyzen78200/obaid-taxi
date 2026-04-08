import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

type NotifPrefs = {
  push_booking_status: boolean
  push_driver_assigned: boolean
  push_reminder_1h: boolean
  push_reminder_15min: boolean
  push_driver_en_route: boolean
  push_booking_cancelled: boolean
  push_loyalty_milestone: boolean
  email_booking_confirmed: boolean
  email_reminder_day_before: boolean
  email_booking_recap: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  push_booking_status: true,
  push_driver_assigned: true,
  push_reminder_1h: true,
  push_reminder_15min: true,
  push_driver_en_route: true,
  push_booking_cancelled: true,
  push_loyalty_milestone: true,
  email_booking_confirmed: true,
  email_reminder_day_before: true,
  email_booking_recap: true,
}

export default function AccountScreen() {
  const router = useRouter()
  const { user, profile, setProfile } = useAuthStore()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [savingNotifs, setSavingNotifs] = useState(false)

  useEffect(() => {
    if (user?.id) loadNotifPrefs()
  }, [user?.id])

  async function loadNotifPrefs() {
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle()
    if (data) setNotifPrefs(data)
  }

  async function handleSaveNotifPrefs() {
    if (!user?.id) return
    setSavingNotifs(true)
    await supabase
      .from('notification_preferences')
      .upsert({ ...notifPrefs, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSavingNotifs(false)
    Alert.alert('Succès', 'Préférences de notifications enregistrées.')
  }

  function toggleNotif(key: keyof NotifPrefs) {
    setNotifPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  async function handleSaveProfile() {
    if (!user) return
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', user.id)

      if (error) throw error

      setProfile({ ...profile!, full_name: fullName.trim(), phone: phone.trim() })
      Alert.alert('Succes', 'Vos informations ont ete mises a jour.')
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de mettre a jour le profil.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      Alert.alert('Erreur', 'Veuillez saisir votre mot de passe actuel.')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.')
      return
    }
    setSavingPassword(true)
    try {
      // Vérification du mot de passe actuel
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      })
      if (signInError) {
        Alert.alert('Erreur', 'Mot de passe actuel incorrect.')
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      Alert.alert('Succes', 'Votre mot de passe a ete modifie.')
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de modifier le mot de passe.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Retour</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Mon compte</Text>
          </View>

          {/* Card : Informations personnelles */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations personnelles</Text>

            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Votre nom complet"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Telephone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+212 6XX XXX XXX"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.primaryButton, savingProfile && styles.disabledButton]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryButtonText}>Enregistrer les modifications</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Card : Notifications push */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔔 Notifications push</Text>
            {([
              { key: 'push_booking_status',   label: 'Changement de statut de la course' },
              { key: 'push_driver_assigned',   label: 'Chauffeur assigné' },
              { key: 'push_reminder_1h',       label: 'Rappel 1h avant la course' },
              { key: 'push_reminder_15min',    label: 'Rappel 15 min avant la course' },
              { key: 'push_driver_en_route',   label: 'Chauffeur en route' },
              { key: 'push_booking_cancelled', label: 'Course annulée' },
              { key: 'push_loyalty_milestone', label: 'Points fidélité' },
            ] as { key: keyof NotifPrefs; label: string }[]).map(item => (
              <View key={item.key} style={styles.notifRow}>
                <Text style={styles.notifLabel}>{item.label}</Text>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={() => toggleNotif(item.key)}
                  trackColor={{ false: '#D1D5DB', true: '#1D4ED8' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>

          {/* Card : Notifications email */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📧 Notifications e-mail</Text>
            {([
              { key: 'email_booking_confirmed',   label: 'Confirmation de réservation' },
              { key: 'email_reminder_day_before',  label: 'Rappel la veille' },
              { key: 'email_booking_recap',        label: 'Récapitulatif après la course' },
            ] as { key: keyof NotifPrefs; label: string }[]).map(item => (
              <View key={item.key} style={styles.notifRow}>
                <Text style={styles.notifLabel}>{item.label}</Text>
                <Switch
                  value={notifPrefs[item.key]}
                  onValueChange={() => toggleNotif(item.key)}
                  trackColor={{ false: '#D1D5DB', true: '#1D4ED8' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.primaryButton, savingNotifs && styles.disabledButton]}
              onPress={handleSaveNotifPrefs}
              disabled={savingNotifs}
            >
              {savingNotifs
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryButtonText}>Enregistrer les préférences</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Card : Securite */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Securite</Text>

            <Text style={styles.label}>Mot de passe actuel</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Votre mot de passe actuel"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              returnKeyType="next"
            />

            <Text style={styles.label}>Nouveau mot de passe</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Au moins 8 caracteres"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              returnKeyType="next"
            />

            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repetez le mot de passe"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleChangePassword}
            />

            <TouchableOpacity
              style={[styles.primaryButton, savingPassword && styles.disabledButton]}
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.primaryButtonText}>Changer le mot de passe</Text>
              }
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },

  header: {
    marginBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },

  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notifLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    paddingRight: 12,
  },
})
