import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import App from './src/App';

// Note: Firebase/FCM removed - using Notifee for local notifications instead
// Local notifications are triggered by Socket.IO events

AppRegistry.registerComponent(appName, () => App);
