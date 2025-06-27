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
import { create, open, LinkSuccess, LinkExit, destroy } from 'react-native-plaid-link-sdk';
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
  const [plaidCompleted, setPlaidCompleted] = useState(false);

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
    }
  };

  const loadSavedAccessToken = async () => {
    try {
      const token = await AsyncStorage.getItem('plaid_access_token');
      if (token) {
        setAccessToken(token);
        if (token === 'demo-token') {
          setSpending({
            daily: 45.67,
            weekly: 234.89,
            monthly: 1247.23
          });
        } else {
          await fetchSpending(token);
        }
      }
    } catch (error) {
      console.error('Error loading saved token:', error);
    }
  };

  const fetchSpending = async (token: string) => {
    if (token === 'demo-token') {
      setSpending({
        daily: 45.67,
        weekly: 234.89,
        monthly: 1247.23
      });
      return;
    }

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
      setLoading(false);
    }
  };

  const onPlaidExit = (exit: LinkExit) => {
    console.log('Plaid exited:', exit);
    // Always show continue button when Plaid exits (whether completed or cancelled)
    setPlaidCompleted(true);
  };

  const openPlaidLink = async () => {
    if (!linkToken) return;
    
    try {
      await destroy();
      create({ token: linkToken });
      
      open({
        onSuccess: onPlaidSuccess,
        onExit: onPlaidExit,
      });
    } catch (error) {
      console.error('Error opening Plaid Link:', error);
    }
  };

  const handleContinue = async () => {
    setPlaidCompleted(false);
    setLoading(true);
    
    const demoSpending = {
      daily: 45.67,
      weekly: 234.89,
      monthly: 1247.23
    };
    
    await AsyncStorage.setItem('plaid_access_token', 'demo-token');
    setAccessToken('demo-token');
    setSpending(demoSpending);
    setLoading(false);
  };

  const onRefresh = async () => {
    if (accessToken) {
      setRefreshing(true);
      await fetchSpending(accessToken);
    }
  };

  const disconnectBank = async () => {
    await AsyncStorage.removeItem('plaid_access_token');
    setAccessToken(null);
    setSpending({ daily: 0, weekly: 0, monthly: 0 });
  };

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.connectContainer}>
          <Text style={styles.title}>BiggerNumbers</Text>
          
          {linkToken ? (
            <TouchableOpacity
              style={[styles.connectButton, loading && styles.disabledButton]}
              disabled={loading}
              onPress={openPlaidLink}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect Bank Account</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.disabledButton} disabled>
              <Text style={styles.connectButtonText}>Loading</Text>
            </TouchableOpacity>
          )}

          {plaidCompleted && (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleContinue}
            >
              <Text style={styles.connectButtonText}>Continue with Demo</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={disconnectBank}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#000000" />
          </View>
        ) : (
          <View style={styles.numbersContainer}>
            <View style={styles.numberCard}>
              <Text style={styles.numberLabel}>Daily</Text>
              <Text style={styles.numberAmount}>{spending.daily.toFixed(2)}</Text>
            </View>

            <View style={styles.numberCard}>
              <Text style={styles.numberLabel}>Weekly</Text>
              <Text style={styles.numberAmount}>{spending.weekly.toFixed(2)}</Text>
            </View>

            <View style={styles.numberCard}>
              <Text style={styles.numberLabel}>Monthly</Text>
              <Text style={styles.numberAmount}>{spending.monthly.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  header: {
    alignItems: 'flex-end',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 60,
  },
  connectButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 20,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  disconnectText: {
    color: '#999999',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  numbersContainer: {
    padding: 40,
    gap: 40,
  },
  numberCard: {
    alignItems: 'center',
  },
  numberLabel: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 8,
  },
  numberAmount: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000000',
  },
});