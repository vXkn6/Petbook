import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import OneSignal from 'onesignal-cordova-plugin';
import { environment } from 'src/environments/environment.prod';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {

  constructor(platform: Platform) {
    platform.ready().then(() => {

      // Enable verbose logging for debugging (remove in production)
      OneSignal.Debug.setLogLevel(6);
      // Initialize with your OneSignal App ID
      OneSignal.initialize(environment.onesignal.appId);
      // Use this method to prompt for push notifications.
      // We recommend removing this method after testing and instead use In-App Messages to prompt for notification permission.
      OneSignal.Notifications.requestPermission(false).then((accepted: boolean) => {
        console.log("User accepted notifications: " + accepted);
      });

    });
  }
}
