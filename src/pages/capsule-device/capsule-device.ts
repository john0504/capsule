import { Component } from '@angular/core';
import { IonicPage, NavController, ViewController, Loading } from 'ionic-angular';

import { WifiSecurityType } from 'app-engine';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { defer } from 'rxjs/observable/defer';
import { delay, repeatWhen, retry } from 'rxjs/operators';
import { NgRedux } from '@angular-redux/store';
import { Storage } from '@ionic/storage';

import { AppActions, AppTasks, ErrorsService } from 'app-engine';

import { ThemeService } from '../../providers/theme-service';
import { CheckNetworkService } from '../../providers/check-network';

import { AppUtils } from '../../utils/app-utils';
import { Geolocation } from '@ionic-native/geolocation';
import { PopupService } from '../../providers/popup-service';
import { TranslateService } from '@ngx-translate/core';

@IonicPage()
@Component({
  selector: 'page-capsule-device',
  templateUrl: 'capsule-device.html'
})
export class CapsuleDevicePage {

  private subs: Array<Subscription>;
  private deviceInfo$: Observable<any>;
  selectAp;
  wifiAps;
  wifiAp: { ssid?: string, password?: string, sec?: string } = {};
  sec;
  useText: boolean = false;
  isSelectFocus: boolean = false;

  iconName: string = "eye";
  inputType: string = "password";
  showPassword: boolean = false;
  loading: Loading;

  vendorVer: string = "";
  vendorName: string = "";
  semiVer: string = "";
  money: string = "";
  gift: string = "";
  devicename: string = "";
  serial: string = "";
  latitude: number = 0;
  longitude: number = 0;
  testMode: boolean = false;
  log: string = "";

  constructor(
    private ngRedux: NgRedux<any>,
    private appTasks: AppTasks,
    private errorsService: ErrorsService,
    public checkNetworkService: CheckNetworkService,
    public navCtrl: NavController,
    public themeService: ThemeService,
    public viewCtrl: ViewController,
    private geolocation: Geolocation,
    private storage: Storage,
    private translate: TranslateService,
    private popupService: PopupService,
  ) {
    this.subs = [];
    this.deviceInfo$ = this.ngRedux.select(['ssidConfirm', 'deviceInfo']);
    this.wifiAp = { ssid: '', password: '', sec: WifiSecurityType.WPA2 };
  }

  clearSSID() {
    if (this.useText) {
      this.selectAp = null;
    }
    this.wifiAp.ssid = '';
  }

  needPassword() {
    return this.wifiAp && this.wifiAp.sec !== WifiSecurityType.OPEN;
  }

  clearPassword() {
    if (this.wifiAp && this.wifiAp.sec === WifiSecurityType.OPEN) {
      this.wifiAp.password = '';
    }
  }

  wifiApSelected() {
    if (this.selectAp) {
      this.wifiAp.ssid = this.selectAp.ssid;
      this.wifiAp.sec = this.selectAp.sec;
      this.clearPassword();
    }
  }

  isMoneyValid(): boolean {
    if (this.money && this.money !== '' && (parseInt(this.money) > 65535 || parseInt(this.money) < 0)) {
      return false;
    } else {
      return true;
    }
  }

  isGiftValid(): boolean {
    if (this.gift && this.gift !== '' && (parseInt(this.gift) > 65535 || parseInt(this.gift) < 0)) {
      return false;
    } else {
      return true;
    }
  }

  isDevicenameValid(): boolean {
    if (this.devicename && this.devicename !== '') {
      var str = encodeURIComponent(this.devicename);
      var len = str.replace(/%[A-F\d]{2}/g, 'U').length;
      if (len > 30)
        return false;
    }
    return true;
  }

  isValid(): boolean {
    if (!this.wifiAp) return false;
    if (!this.wifiAp.ssid || this.wifiAp.ssid === '')
      return false;
    if (!(this.wifiAp.sec === WifiSecurityType.OPEN || this.wifiAp.sec === WifiSecurityType.WEP ||
      this.wifiAp.sec === WifiSecurityType.WPA2 || this.wifiAp.sec === WifiSecurityType.WPA))
      return false;
    if ((!this.wifiAp.password || this.wifiAp.password === '') &&
      this.wifiAp.sec !== WifiSecurityType.OPEN)
      return false;
    if (this.wifiAp.password && this.wifiAp.password.length < 8)
      return false;

    if (!this.money || this.money === '')
      return false;
    if (!this.gift || this.gift === '')
      return false;
    if (!this.devicename || this.devicename === '')
      return false;
    if (this.testMode && (!this.serial || this.serial === ''))
      return false;

    if (!this.isMoneyValid() || !this.isGiftValid() || !this.isDevicenameValid())
      return false;
      
    return true;
  }

  onNext() {
    this.localMode()
      .pipe(delay(10000))
      .subscribe(() => {
        this.loading.dismiss();
        this.viewCtrl.dismiss();
      }, (error) => {
        this.loading.dismiss();
        this.log += ("\r\n" + JSON.stringify(error));
      });
  }

  private localMode() {
    this.loading = this.popupService.makeLoading({
      content: this.translate.instant('PROVISION_LOADING.CONNECTING')
    });
    return defer(() => this.localModePromise())
      .pipe(retry(2));
  }

  private localModePromise() {
    let command = this.testMode ? {
      "ssid": this.wifiAp.ssid,
      "password": this.wifiAp.password,
      "sec": this.wifiAp.sec,
      "money": this.money,
      "gift": this.gift,
      "name": this.devicename,
      "serial": this.serial,
      "latitude": round(this.latitude, 7),
      "longitude": round(this.longitude, 7)
    } : {
        "ssid": this.wifiAp.ssid,
        "password": this.wifiAp.password,
        "sec": this.wifiAp.sec,
        "money": this.money,
        "gift": this.gift,
        "name": this.devicename,
        "latitude": round(this.latitude, 7),
        "longitude": round(this.longitude, 7)
      };
    this.log = JSON.stringify(command);
    return this.appTasks.localModeTask(JSON.stringify(command));
  }

  onShowHidePassword() {
    this.showPassword = !this.showPassword;
    if (this.showPassword) {
      this.inputType = "text";
      this.iconName = "eye-off";
    }
    else {
      this.inputType = "password";
      this.iconName = "eye";
    }
  }

  private setupTestMode() {
    return this.storage.get('testMode')
      .then((testMode) => {
        if (testMode) {
          this.testMode = testMode;
        } else {
          this.testMode = false;
        }
      });
  }

  ionViewDidLoad() {
    this.checkNetworkService.pause();
    this.setupTestMode();
  }

  ionViewDidEnter() {
    this.geolocation.getCurrentPosition().then((resp) => {
      this.latitude = resp.coords.latitude;
      this.longitude = resp.coords.longitude;
    }).catch((error) => {
      console.log('Error getting location', error);
    });
    this.subs.push(
      this.errorsService.getSubject()
        .subscribe(error => this.handleErrors(error))
    );
    this.subs.push(
      this.queryDeviceInfo()
        .pipe(repeatWhen(attampes => attampes.pipe(delay(10000))))
        .subscribe()
    );
    this.subs.push(
      this.deviceInfo$
        .subscribe(deviceInfo => {
          if (deviceInfo) {
            this.vendorVer = "FW Version : " + deviceInfo ? deviceInfo["VendorVer"] : "";
            this.vendorName = "FW Name : " + deviceInfo ? deviceInfo["VendorStr"] : "";
            this.semiVer = "Semi Version : " + deviceInfo ? deviceInfo["SemiVer"] : "";
          }
          if (!this.isSelectFocus && !this.useText) {
            let _wifiAps = deviceInfo && deviceInfo.wifi ? deviceInfo.wifi : [];
            _wifiAps = _wifiAps.sort((a, b) => AppUtils.compareWifiSignalStrength(a, b));
            _wifiAps = JSON.parse(JSON.stringify(_wifiAps));
            this.wifiAps = _wifiAps;
            const _selectAp = _wifiAps.find(wifiAp => wifiAp.ssid === this.wifiAp.ssid);
            if (_selectAp) {
              this.selectAp = _selectAp;
            } else if (this.selectAp) {
              _wifiAps.push(this.selectAp);
            }
          }
        })
    );
  }

  ionViewWillLeave() {
    this.subs && this.subs.forEach((s) => {
      s.unsubscribe();
    });
    this.subs.length = 0;
  }

  ionViewWillUnload() {
    this.checkNetworkService.resume();
  }

  compareFn(e1, e2): boolean {
    return e1.ssid === e2.ssid;
  }

  private queryDeviceInfo() {
    return defer(() => this.appTasks.queryDeviceInfoTask());
  }

  // error is an action
  private handleErrors(error) {
    switch (error.type) {
      case AppActions.QUERY_DEVICE_INFO_DONE:
        break;
    }
  }

  closePage() {
    this.viewCtrl.dismiss();
  }
}

const INITIAL_STATE = {
  deviceInfo: null,
  caResponse: null
};

export function ssidConfirmReducer(state = INITIAL_STATE, action) {
  switch (action.type) {
    case AppActions.QUERY_DEVICE_INFO_DONE:
      if (!action.error) {
        return Object.assign({}, state, { deviceInfo: action.payload, });
      }
      return state;
    default:
      return state;
  }
}

function round(value: number, precision: number) {
  const base = 10 ** precision;
  return Math.round(value * base) / base;
}