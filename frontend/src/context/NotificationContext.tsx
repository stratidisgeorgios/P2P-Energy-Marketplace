import React, { createContext, useCallback, useContext } from 'react'
import { Notification } from '../types'

interface NotificationContextType {
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const addNotification = useCallback((_notification: Omit<Notification, 'id'>) => {
    // This would be implemented with a notification state management library
    console.log('Notification:', _notification)
  }, [])

  const removeNotification = useCallback((_id: string) => {
    // This would remove the notification
  }, [])

  const value: NotificationContextType = {
    addNotification,
    removeNotification,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
