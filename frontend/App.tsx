import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ScrollView,
} from 'react-native';
// Correct imports based on actual exports
import { create, open, LinkSuccess, LinkExit, LinkOpenProps } from 'react-native-plaid-link-sdk';

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.1.225:8001';

interface SpendingData {
  daily: number;
  weekly: number;
  monthly: number;
}

export default function App() {
  const [spending, setSpending] = useState<SpendingData>({
    daily: 0,
    weekly: 0,
    monthly: 0,
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await createLinkToken();
    await loadSavedAccessToken();
  };

  const createLinkToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/create_link_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error creating link token:', error);
      Alert.alert('Error', 'Failed to initialize Plaid. Please try again.');
    }
  };

  const loadSavedAccessToken = async () => {
    try {
      const token = await AsyncStorage.getItem('plaid_access_token');
      if (token) {
        setAccessToken(token);
        await fetchSpending(token);
      }
    } catch (error) {
      console.error('Error loading saved token:', error);
    }
  };

  const fetchSpending = async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/spending/${token}`);

      if (!response.ok) {
        throw new Error('Failed to fetch spending data');
      }

      const data: SpendingData = await response.json();
      setSpending(data);
    } catch (error) {
      console.error('Error fetching spending:', error);
      Alert.alert('Error', 'Failed to fetch spending data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onPlaidSuccess = async (success: LinkSuccess) => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/exchange_public_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_token: success.publicToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }

      const data = await response.json();
      const token = data.access_token;

      await AsyncStorage.setItem('plaid_access_token', token);
      setAccessToken(token);
      await fetchSpending(token);
    } catch (error) {
      console.error('Error in Plaid success:', error);
      Alert.alert('Error', 'Failed to connect your bank account. Please try again.');
      setLoading(false);
    }
  };

  const onPlaidExit = (exit: LinkExit) => {
    console.log('Plaid Link exited:', exit);
  };

  const openPlaidLink = async () => {
    if (!linkToken) return;
    
    try {
      // Create Plaid Link with just token
      create({ token: linkToken });
      
      // Open Plaid Link with callbacks (needs LinkOpenProps)
      const openProps: LinkOpenProps = {
        onSuccess: onPlaidSuccess,
        onExit: onPlaidExit,
      };
      
      open(openProps);
    } catch (error) {
      console.error('Error opening Plaid Link:', error);
      Alert.alert('Error', 'Failed to open bank connection');
    }
  };

  const onRefresh = async () => {
    if (accessToken) {
      setRefreshing(true);
      await fetchSpending(accessToken);
    }
  };

  const disconnectBank = async () => {
    Alert.alert(
      'Disconnect Bank',
      'Are you sure you want to disconnect your bank account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('plaid_access_token');
            setAccessToken(null);
            setSpending({ daily: 0, weekly: 0, monthly: 0 });
          },
        },
      ]
    );
  };

  // Connection screen
  if (!accessToken) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.connectContainer}>
          <Text style={styles.title}>💳 BiggerNumbers</Text>
          <Text style={styles.subtitle}>
            Your spending in just three numbers
          </Text>

          <View style={styles.featureList}>
            <Text style={styles.featureItem}>📊 Daily spending</Text>
            <Text style={styles.featureItem}>📅 Weekly spending</Text>
            <Text style={styles.featureItem}>📈 Monthly spending</Text>
          </View>

          {linkToken ? (
            <TouchableOpacity
              style={[styles.connectButton, loading && styles.disabledButton]}
              disabled={loading}
              onPress={openPlaidLink}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect Bank Account</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.disabledButton} disabled>
              <Text style={styles.connectButtonText}>Loading...</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.securityNote}>
            🔒 Your data is encrypted and secure. We never store your bank credentials.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Main dashboard
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Numbers</Text>
          <TouchableOpacity onPress={disconnectBank} style={styles.disconnectButton}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading your spending data...</Text>
          </View>
        ) : (
          <View style={styles.cardsContainer}>
            <View style={styles.spendingCard}>
              <Text style={styles.cardLabel}>Daily</Text>
              <Text style={styles.cardAmount}>£{spending.daily.toFixed(2)}</Text>
              <Text style={styles.cardSubtext}>Last 24 hours</Text>
            </View>

            <View style={styles.spendingCard}>
              <Text style={styles.cardLabel}>Weekly</Text>
              <Text style={styles.cardAmount}>£{spending.weekly.toFixed(2)}</Text>
              <Text style={styles.cardSubtext}>Last 7 days</Text>
            </View>

            <View style={styles.spendingCard}>
              <Text style={styles.cardLabel}>Monthly</Text>
              <Text style={styles.cardAmount}>£{spending.monthly.toFixed(2)}</Text>
              <Text style={styles.cardSubtext}>Last 30 days</Text>
            </View>
          </View>
        )}

        <Text style={styles.pullToRefresh}>Pull to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
    lineHeight: 24,
  },
  featureList: {
    alignItems: 'center',
    marginBottom: 40,
  },
  featureItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  securityNote: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ff3b30',
  },
  disconnectText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  cardsContainer: {
    padding: 20,
    gap: 16,
  },
  spendingCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  cardAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#999',
  },
  pullToRefresh: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginTop: 20,
    marginBottom: 40,
  },
});