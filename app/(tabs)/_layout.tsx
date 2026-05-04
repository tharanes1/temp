import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CustomTabBar from '@/shared/components/layout/CustomTabBar';

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: t('nav.shifts'),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('nav.orders'),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t('nav.earnings'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
        }}
      />
      {/* Hidden legacy tab */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
