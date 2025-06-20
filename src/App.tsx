

import React, { useState, useEffect, useRef, CSSProperties, useCallback } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';

// --- TEXT TRANSLATIONS ---
type Language = 'fa' | 'ps' | 'en';

const translations = {
  fa: {
    languageName: "فارسی",
    welcomeTitle: "!خوش آمدید",
    welcomeSubtitle: ".شماره موبایل خود را وارد کنید تا با شما در تماس باشیم",
    mobileNumberLabel: "شماره موبایل",
    termsAcceptance: "با ثبت نام، <a href='#' class='terms-link'>شرایط و ضوابط</a> و <a href='#' class='terms-link'>سیاست حفظ حریم خصوصی</a> را می پذیرم.",
    nextButtonAriaLabel: "مرحله بعد",
    invalidPhoneError: "شماره تلفن وارد شده صحیح نمی‌باشد. لطفاً یک شماره معتبر ۱۰ رقمی مانند 0701234567 وارد کنید.",
    acceptTermsError: "لطفاً شرایط و قوانین را بپذیرید.",
    otpScreenTitle: "لطفاً کد فعال سازی رو وارد بکنید",
    otpScreenSubtitle: "کد ۶ رقمی به شماره {phoneNumber} ارسال گردید.",
    changeNumber: "تغییر شماره",
    resendOtp: "ارسال مجدد کد",
    resendOtpCountdown: "ارسال مجدد کد تا {timer} ثانیه دیگر",
    confirmOtpButton: "تایید و ادامه",
    invalidOtpError: "کد وارد شده باید ۶ رقم معتبر باشد.",
    mapScreenTitleOrigin: "انتخاب مبدأ",
    mapScreenTitleDestination: "انتخاب مقصد",
    currentLocationLabel: "کجایی؟", 
    confirmOriginButton: "تأیید مبدأ",
    confirmDestinationButton: "مقصد را تأیید کنید",
    serviceForSelf: "برای خودم",
    serviceForOther: "برای دیگران",
    gpsButtonAriaLabel: "موقعیت فعلی من",
    addressLoading: "در حال دریافت آدرس...",
    addressError: "خطا در دریافت آدرس. لطفاً دوباره تلاش کنید.",
    addressNotFound: "آدرسی برای این نقطه یافت نشد.",
    homeButtonAriaLabel: "خانه",
    profileButtonAriaLabel: "پروفایل",
    searchIconAriaLabel: "جستجو",
    searchPlaceholderOrigin: "جستجوی مبدأ...",
    searchPlaceholderDestination: "جستجوی مقصد...",
    searchAddressLabel: "فیلد جستجوی آدرس",
    searchNoResults: "نتیجه‌ای برای جستجوی شما یافت نشد.",
    searchApiError: "خطا در جستجوی آدرس. لطفاً دوباره تلاش کنید.",
    searchingAddress: "در حال جستجو...",
    backButtonAriaLabel: "بازگشت به انتخاب مبدأ",
    closeSheetButtonAriaLabel: "بستن انتخاب سرویس",
    originMarkerAriaLabel: "نشانگر مبدأ",
    destinationMarkerAriaLabel: "نشانگر مقصد",
    tripConfirmedMessage: "سفر شما تأیید شد!\nمبدأ: {origin}\nمقصد: {destination}",
    // Service Selection Sheet Translations
    serviceCategoryPassenger: "سواری",
    serviceCategoryCargo: "باری",
    serviceCategoryCourier: "پیک موتوری",
    serviceNameRickshaw: "رکشا",
    serviceDescRickshaw: "سه‌چرخه اقتصادی",
    serviceNameCar: "ماشین",
    serviceDescCar: "خودروی راحت",
    serviceNameCargoRickshaw: "رکشا باری",
    serviceDescCargoRickshaw: "برای حمل بار",
    rideOptions: "گزینه های سواری",
    coupon: "کوپن",
    requestRideButtonText: "درخواست سرویس",
    scheduledRideButtonAriaLabel: "زمان‌بندی سفر",
    priceUnit: "افغانی",
    rideRequestedMessage: "درخواست سفر برای {serviceName} با موفقیت ثبت شد!",
    selectServicePrompt: "لطفاً یک سرویس را انتخاب کنید.",
    calculatingPrice: "در حال محاسبه قیمت...",
    priceCalculationError: "خطا در محاسبه قیمت.",
    // Driver Search Sheet Translations
    searchingForDriver: "جستجو برای نزدیکترین درایور...",
    noDriverFoundError: "متاسفانه هیچ راننده‌ای پیدا نشد.",
    tryAgainButton: "دوباره امتحان کنید",
    cancelButton: "لغو کنید",
    driversNotifiedMessage: "ما درخواست سواری شما را برای {count} راننده نزدیک ارسال کرده ایم...",
    closeDriverSearchSheetAriaLabel: "بستن پنل جستجوی راننده",
    // Trip In Progress Sheet Translations
    driverAssignedTitle: "راننده پیدا شد!",
    tripInProgressTitle: "سفر در حال انجام",
    enRouteToDestinationStatus: "در مسیر به مقصد...",
    etaLabel: "زمان تخمینی رسیدن:",
    etaUnitMinutes: "دقیقه",
    driverNameLabel: "نام راننده:",
    carModelLabel: "نوع وسیله:", 
    plateNumberLabel: "شماره پلاک:",
    callDriverButton: "تماس با راننده",
    messageDriverButton: "پیام به راننده",
    fareLabel: "کرایه:",
    paymentStatusLabel: "وضعیت پرداخت:",
    payButton: "پرداخت کنید",
    changeDestinationButton: "تغییر مقصد",
    rideOptionsButton: "گزینه های سواری",
    cancelRideButton: "لغو سواری",
    safetyButton: "ایمنی",
    insufficientBalance: "اعتبار ناکافی آنلاین",
    pullUpForDetails: "برای جزئیات بیشتر بکشید بالا",
    closeTripInfoSheetAriaLabel: "بستن اطلاعات سفر",
    fareNotAvailable: "نامشخص",
    tripEndedSuccessfullyTitle: "سفر شما با موفقیت به پایان رسید!",
    rateDriverPrompt: "به راننده امتیاز دهید:",
    submitRatingButton: "ثبت امتیاز",
    skipRatingButton: "بعداً",
    starAriaLabel: "ستاره {index}",
  },
  ps: {
    languageName: "پشتو",
    welcomeTitle: "ښه راغلاست!",
    welcomeSubtitle: ".خپل ګرځنده شمیره دننه کړئ ترڅو موږ وکولی شو له تاسو سره اړیکه ونیسو",
    mobileNumberLabel: "ګرځنده شمیره",
    termsAcceptance: "د نوم لیکنې په کولو سره، زه <a href='#' class='terms-link'>شرایط او مقررات</a> او د <a href='#' class='terms-link'>محرمیت پالیسي</a> منم.",
    nextButtonAriaLabel: "بل ګام",
    invalidPhoneError: "داخل شوی د تلیفون شمیره سمه نه ده. مهرباني وکړئ یو باوري ۱۰ عددي شمیره دننه کړئ لکه 0701234567.",
    acceptTermsError: "مهرباني وکړئ شرایط او مقررات ومنئ.",
    otpScreenTitle: "مهرباني وکړئ د فعالولو کوډ دننه کړئ",
    otpScreenSubtitle: "شپږ عددي کوډ {phoneNumber} شمیرې ته واستول شو.",
    changeNumber: "شمیره بدله کړئ",
    resendOtp: "کوډ بیا واستوئ",
    resendOtpCountdown: "تر {timer} ثانیو پورې کوډ بیا واستوئ",
    confirmOtpButton: "تایید او ادامه ورکړئ",
    invalidOtpError: "کوډ باید ۶ معتبر عددونه ولري.",
    mapScreenTitleOrigin: "د مبدا ټاکنه",
    mapScreenTitleDestination: "د مقصد ټاکنه",
    currentLocationLabel: "چیرته یې؟",
    confirmOriginButton: "مبدا تایید کړه",
    confirmDestinationButton: "مقصد تایید کړئ",
    serviceForSelf: "زما لپاره",
    serviceForOther: "د نورو لپاره",
    gpsButtonAriaLabel: "زما اوسنی ځای",
    addressLoading: "پته ترلاسه کیږي...",
    addressError: "د پته په ترلاسه کولو کې تېروتنه. مهرباني وکړئ بیا هڅه وکړئ.",
    addressNotFound: "د دې ځای لپاره پته ونه موندل شوه.",
    homeButtonAriaLabel: "کور",
    profileButtonAriaLabel: "پروفایل",
    searchIconAriaLabel: "لټون",
    searchPlaceholderOrigin: "مبدأ ولټوئ...",
    searchPlaceholderDestination: "مقصد ولټوئ...",
    searchAddressLabel: "د پته لټون فیلډ",
    searchNoResults: "ستاسو د لټون لپاره کومه پایله ونه موندل شوه.",
    searchApiError: "د پته په لټون کې تېروتنه. مهرباني وکړئ بیا هڅه وکړئ.",
    searchingAddress: "لټون روان دی...",
    backButtonAriaLabel: "د مبدا ټاکنې ته بیرته ستنیدل",
    closeSheetButtonAriaLabel: "د خدمت ټاکنه وتړئ",
    originMarkerAriaLabel: "د مبدا نښه کوونکی",
    destinationMarkerAriaLabel: "د مقصد نښه کوونکی",
    tripConfirmedMessage: "ستاسو سفر تایید شو!\nمبدأ: {origin}\nمقصد: {destination}",
    serviceCategoryPassenger: "سواري",
    serviceCategoryCargo: "بار",
    serviceCategoryCourier: "پيک موټوري",
    serviceNameRickshaw: "رکشا",
    serviceDescRickshaw: "اقتصادي درې عرادې",
    serviceNameCar: "ماشین",
    serviceDescCar: "آرام موټر",
    serviceNameCargoRickshaw: "بار وړونکې رکشا",
    serviceDescCargoRickshaw: "د بار وړلو لپاره",
    rideOptions: "د سفر اختیارونه",
    coupon: "کوپن",
    requestRideButtonText: "خدمت غوښتنه",
    scheduledRideButtonAriaLabel: "سفر مهالویش کړئ",
    priceUnit: "افغانۍ",
    rideRequestedMessage: "د {serviceName} لپاره د سفر غوښتنه په بریالیتوب سره ثبت شوه!",
    selectServicePrompt: "مهرباني وکړئ یو خدمت وټاکئ.",
    calculatingPrice: "بیه محاسبه کیږي...",
    priceCalculationError: "د بیې په محاسبه کې تېروتنه.",
    searchingForDriver: "د نږدې چلوونکي لټون...",
    noDriverFoundError: "له بده مرغه هیڅ چلوونکی ونه موندل شو.",
    tryAgainButton: "بیا هڅه وکړئ",
    cancelButton: "لغوه کول",
    driversNotifiedMessage: "موږ ستاسو د سفر غوښتنه {count} نږدې چلوونکو ته استولې ده...",
    closeDriverSearchSheetAriaLabel: "د چلوونکي لټون پینل وتړئ",
    driverAssignedTitle: "چلوونکی وموندل شو!",
    tripInProgressTitle: "سفر په جریان کې دی",
    enRouteToDestinationStatus: "مقصد ته په لاره...",
    etaLabel: "اټکل شوی د رسیدو وخت:",
    etaUnitMinutes: "دقیقې",
    driverNameLabel: "د چلوونکي نوم:",
    carModelLabel: "د وسیلې ډول:", 
    plateNumberLabel: "د پلیټ شمیره:",
    callDriverButton: "چلوونکي ته زنګ ووهئ",
    messageDriverButton: "چلوونکي ته پیغام واستوئ",
    fareLabel: "کرایه:",
    paymentStatusLabel: "د تادیې وضعیت:",
    payButton: "تادیه وکړئ",
    changeDestinationButton: "مقصد بدل کړئ",
    rideOptionsButton: "د سفر اختیارونه",
    cancelRideButton: "سفر لغوه کړئ",
    safetyButton: "خوندیتوب",
    insufficientBalance: "آنلاین کریډیټ کافي نه دی",
    pullUpForDetails: "د نورو جزیاتو لپاره پورته کش کړئ",
    closeTripInfoSheetAriaLabel: "د سفر معلومات بند کړئ",
    fareNotAvailable: "نامعلومه",
    tripEndedSuccessfullyTitle: "ستاسو سفر په بریالیتوب سره پای ته ورسېد!",
    rateDriverPrompt: "چلوونکي ته امتیاز ورکړئ:",
    submitRatingButton: "امتیاز ثبت کړئ",
    skipRatingButton: "وروسته",
    starAriaLabel: "ستوری {index}",
  },
  en: {
    languageName: "English",
    welcomeTitle: "Welcome!",
    welcomeSubtitle: "Enter your mobile number so we can contact you.",
    mobileNumberLabel: "Mobile Number",
    termsAcceptance: "By registering, I accept the <a href='#' class='terms-link'>Terms and Conditions</a> and <a href='#' class='terms-link'>Privacy Policy</a>.",
    nextButtonAriaLabel: "Next",
    invalidPhoneError: "The phone number entered is incorrect. Please enter a valid 10-digit number like 0701234567.",
    acceptTermsError: "Please accept the terms and conditions.",
    otpScreenTitle: "Please enter the activation code",
    otpScreenSubtitle: "The 6-digit code has been sent to {phoneNumber}.",
    changeNumber: "Change number",
    resendOtp: "Resend code",
    resendOtpCountdown: "Resend code in {timer} seconds",
    confirmOtpButton: "Confirm and Continue",
    invalidOtpError: "The entered code must be 6 valid digits.",
    mapScreenTitleOrigin: "Select Origin",
    mapScreenTitleDestination: "Select Destination",
    currentLocationLabel: "Where are you?",
    confirmOriginButton: "Confirm Origin",
    confirmDestinationButton: "Confirm Destination",
    serviceForSelf: "For myself",
    serviceForOther: "For others",
    gpsButtonAriaLabel: "My current location",
    addressLoading: "Fetching address...",
    addressError: "Error fetching address. Please try again.",
    addressNotFound: "Address not found for this location.",
    homeButtonAriaLabel: "Home",
    profileButtonAriaLabel: "Profile",
    searchIconAriaLabel: "Search",
    searchPlaceholderOrigin: "Search origin...",
    searchPlaceholderDestination: "Search destination...",
    searchAddressLabel: "Address search input",
    searchNoResults: "No results found for your search.",
    searchApiError: "Error searching address. Please try again.",
    searchingAddress: "Searching...",
    backButtonAriaLabel: "Back to origin selection",
    closeSheetButtonAriaLabel: "Close service selection",
    originMarkerAriaLabel: "Origin marker",
    destinationMarkerAriaLabel: "Destination marker",
    tripConfirmedMessage: "Your trip is confirmed!\nOrigin: {origin}\nDestination: {destination}",
    serviceCategoryPassenger: "Passenger",
    serviceCategoryCargo: "Cargo",
    serviceCategoryCourier: "Courier",
    serviceNameRickshaw: "Rickshaw",
    serviceDescRickshaw: "Economic three-wheeler",
    serviceNameCar: "Car",
    serviceDescCar: "Comfortable car",
    serviceNameCargoRickshaw: "Cargo Rickshaw",
    serviceDescCargoRickshaw: "For cargo transport",
    rideOptions: "Ride Options",
    coupon: "Coupon",
    requestRideButtonText: "Request Service",
    scheduledRideButtonAriaLabel: "Schedule Ride",
    priceUnit: "AFN",
    rideRequestedMessage: "Ride request for {serviceName} was successful!",
    selectServicePrompt: "Please select a service.",
    calculatingPrice: "Calculating price...",
    priceCalculationError: "Error calculating price.",
    searchingForDriver: "Searching for the nearest driver...",
    noDriverFoundError: "Unfortunately, no driver was found.",
    tryAgainButton: "Try Again",
    cancelButton: "Cancel",
    driversNotifiedMessage: "We have sent your ride request to {count} nearby drivers...",
    closeDriverSearchSheetAriaLabel: "Close driver search panel",
    driverAssignedTitle: "Driver Found!",
    tripInProgressTitle: "Trip In Progress",
    enRouteToDestinationStatus: "En route to destination...",
    etaLabel: "ETA:",
    etaUnitMinutes: "min",
    driverNameLabel: "Driver Name:",
    carModelLabel: "Vehicle Type:", 
    plateNumberLabel: "Plate Number:",
    callDriverButton: "Call Driver",
    messageDriverButton: "Message Driver",
    fareLabel: "Fare:",
    paymentStatusLabel: "Payment Status:",
    payButton: "Pay Now",
    changeDestinationButton: "Change Destination",
    rideOptionsButton: "Ride Options",
    cancelRideButton: "Cancel Ride",
    safetyButton: "Safety",
    insufficientBalance: "Insufficient Online Balance",
    pullUpForDetails: "Pull up for details",
    closeTripInfoSheetAriaLabel: "Close trip info",
    fareNotAvailable: "N/A",
    tripEndedSuccessfullyTitle: "Your trip has ended successfully!",
    rateDriverPrompt: "Rate your driver:",
    submitRatingButton: "Submit Rating",
    skipRatingButton: "Later",
    starAriaLabel: "Star {index}",
  }
};

// --- SVG Icons ---
const StarIcon = ({ filled, onClick, onMouseEnter, onMouseLeave, style, ariaLabel }: { filled: boolean; onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void; style?: CSSProperties; ariaLabel?: string }) => (
    <svg 
      style={{ width: '2rem', height: '2rem', color: filled ? '#FFC107' : '#E0E0E0', cursor: onClick ? 'pointer' : 'default', transition: 'color 0.2s', ...style }} 
      viewBox="0 0 20 20" 
      fill="currentColor"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={onClick ? 0 : -1}
      aria-label={ariaLabel}
      aria-pressed={filled}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

const PhoneIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
);
const MessageBubbleIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
    </svg>
);

const EditLocationIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
);
const RideOptionsIcon = ({ style }: { style?: CSSProperties }) => ( // Sliders icon
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);
const CancelRideIcon = ({ style }: { style?: CSSProperties }) => ( // Prohibition sign
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);
const SafetyShieldIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 1.944c.974 0 1.895.195 2.731.55l.288.121c.28.118.525.295.719.516l.243.284c.398.465.702.996.882 1.565l.089.283c.184.587.272 1.206.272 1.836v1.317c0 .63-.088 1.249-.272 1.836l-.089.283a3.834 3.834 0 01-.882 1.565l-.243.284c-.194.221-.439.398-.719.516l-.288.121a6.07 6.07 0 01-2.731.55c-.974 0-1.895-.195-2.731-.55l-.288-.121a1.99 1.99 0 01-.719-.516l-.243-.284a3.834 3.834 0 01-.882-1.565l-.089-.283A6.15 6.15 0 013.075 10c0-.63.088-1.249.272-1.836l.089-.283a3.834 3.834 0 01.882-1.565l.243-.284a1.99 1.99 0 01.719-.516l.288-.121A6.07 6.07 0 0110 1.944zM9 13a1 1 0 112 0v2a1 1 0 11-2 0v-2zm0-7a1 1 0 011-1h.01a1 1 0 010 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);
const ClockIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
);

const LicensePlateAFGIcon = ({ plateParts, style }: { plateParts: { region: string, numbers: string, type: string }, style?: CSSProperties }) => {
    const isRTL = true; // Afghan plates are RTL
    const containerStyle: CSSProperties = {
        display: 'inline-flex',
        direction: isRTL ? 'rtl' : 'ltr',
        border: '2px solid #333',
        borderRadius: '0.25rem',
        backgroundColor: 'white',
        color: 'black',
        fontFamily: 'Arial, "B Nazanin", "B Koodak", sans-serif', // Typical plate fonts
        fontWeight: 'bold',
        overflow: 'hidden',
        height: '2.2rem',
        ...style
    };
    const partStyle: CSSProperties = {
        padding: '0.25rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        minWidth: '2rem',
    };
    const regionStyle: CSSProperties = {
        ...partStyle,
        backgroundColor: '#007bff', // Blue for region
        color: 'white',
        fontSize: '0.8rem',
        borderLeft: isRTL ? 'none' : '2px solid #333',
        borderRight: isRTL ? '2px solid #333' : 'none',
        padding: '0.25rem 0.4rem',
    };
    const numberStyle: CSSProperties = { ...partStyle, letterSpacing: '0.1em' };
    const typeStyle: CSSProperties = {
        ...partStyle,
        backgroundColor: 'black',
        color: 'white',
        writingMode: 'vertical-rl', // Rotate text
        textOrientation: 'mixed',
        fontSize: '0.8rem',
        padding: '0.25rem 0.3rem',
        borderLeft: isRTL ? '2px solid #333' : 'none',
        borderRight: isRTL ? 'none' : '2px solid #333',
    };

    return (
        <div style={containerStyle}>
            <div style={typeStyle}>{plateParts.type}</div>
            <div style={numberStyle}>{plateParts.numbers}</div>
            <div style={regionStyle}>{plateParts.region}</div>
        </div>
    );
};

const DriverCarIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '2.5rem', height: '2.5rem', filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.7))', ...style }} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M43.0869 20.8696C42.8261 19.3478 41.5652 18.2609 40 18.2609H10C8.43478 18.2609 7.17391 19.3478 6.91304 20.8696L3.47826 34.7826C3.04348 36.8696 3.04348 38.6957 4.13043 40.2174C5.21739 41.7391 6.95652 42.6087 8.69565 42.6087H41.3043C43.0435 42.6087 44.7826 41.7391 45.8696 40.2174C46.9565 38.6957 46.9565 36.8696 46.5217 34.7826L43.0869 20.8696Z" fill="#FFC107"/> {/* Main body Yellow */}
      <path d="M39.1304 18.2609H10.8696C9.65217 18.2609 8.69565 17.3043 8.69565 16.087V13.913C8.69565 12.6957 9.65217 11.7391 10.8696 11.7391H39.1304C40.3478 11.7391 41.3043 12.6957 41.3043 13.913V16.087C41.3043 17.3043 40.3478 18.2609 39.1304 18.2609Z" fill="#87CEEB"/> {/* Roof SkyBlue */}
      <path d="M13.913 22.1739H36.087V28.6957H13.913V22.1739Z" fill="#ADD8E6"/> {/* Windows LightBlue */}
      <circle cx="11.7391" cy="39.1304" r="4.34783" fill="#333333"/> {/* Wheels */}
      <circle cx="38.2609" cy="39.1304" r="4.34783" fill="#333333"/>
    </svg>
  );

const RightArrowIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M9.70492 17.9998L8.29492 16.5898L12.8749 11.9998L8.29492 7.40984L9.70492 5.99984L15.7049 11.9998L9.70492 17.9998Z"/>
  </svg>
);
const HomeIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
);
const ProfileIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
);
const GpsIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
);
const SearchIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
);
const LocationMarkerIcon = ({ style, ariaLabel }: { style?: CSSProperties, ariaLabel?: string }) => ( 
  <svg style={{ width: '2.5rem', height: '2.5rem', ...style }} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel}>
    <path fillRule="evenodd" clipRule="evenodd" d="M16 3C10.48 3 6 7.48 6 13C6 22 16 31 16 31C16 31 26 22 26 13C26 7.48 21.52 3 16 3ZM16 17.5C13.51 17.5 11.5 15.49 11.5 13C11.5 10.51 13.51 8.5 16 8.5C18.49 8.5 20.5 10.51 20.5 13C20.5 15.49 18.49 17.5 16 17.5Z" fill="#007bff"/>
    <circle cx="16" cy="13" r="4.5" fill="#FFFFFF"/>
  </svg>
);
const DestinationMarkerIcon = ({ style, ariaLabel }: { style?: CSSProperties, ariaLabel?: string }) => (
    <svg style={{ width: '2.5rem', height: '2.5rem', ...style }} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel}>
        <rect x="6" y="6" width="20" height="20" rx="3" fill="#28a745"/>
        <circle cx="16" cy="16" r="4" fill="white"/>
    </svg>
);
const BackArrowIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
  </svg>
);
const ChevronDownIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
);

const FilterIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V15a1 1 0 01-.293.707l-2 2A1 1 0 019 17v-6.586L3.293 6.707A1 1 0 013 6V3z" />
  </svg>
);
const TagIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM6 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);
const ScheduledRideIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.75rem', height: '1.75rem', ...style }} viewBox="0 0 24 24" fill="currentColor" >
    <path d="M19.98 5.48c-.07-.16-.14-.32-.23-.48L18.41 2.29C18.22 1.9 17.84 1.63 17.41 1.63H6.59c-.43 0-.81.27-1 .66L4.25 5.01c-.09.15-.16.31-.23.47C2.18 8.07 1.25 10.06 1.25 12s.93 3.93 2.77 6.52c.07.16.14.32.23.48l1.34 2.71c.19.39.57.66 1 .66h10.82c.43 0 .81-.27 1-.66l1.34-2.71c.09-.15.16-.31.23-.47 1.84-2.59 2.77-4.58 2.77-6.52s-.93-3.93-2.77-6.52zM6.63 3.13h10.74l1 2H5.63l1-2zM4.75 12c0-1.51.74-3.23 2-5.38h10.5c1.26 2.15 2 3.87 2 5.38s-.74 3.23-2 5.38H6.75c-1.26-2.15-2-3.87-2-5.38zm7.25 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-1-3.5h2V12h3V10H13V7h-2v3H8v2h3v3.5z"/>
  </svg>
);

const CloseIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
);

const RetryIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
    </svg>
);

const SearchingCarAnimationIcon = ({ style }: { style?: CSSProperties }) => (
  <svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg" style={{ width: '8rem', height: '4rem', margin: '1rem auto', display: 'block', ...style }}>
    <style>
      {`
        .car-body { fill: #4CAF50; }
        .car-window { fill: #B2DFDB; }
        .car-wheel { fill: #333; }
        .road-line { stroke: #BDBDBD; stroke-width: 2; stroke-dasharray: 10, 8; animation: moveRoad 0.5s linear infinite; }
        @keyframes moveRoad { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 18; } }
        .sun { fill: #FFC107; }
        .cloud { fill: #E0E0E0; animation: moveClouds 10s linear infinite; }
        @keyframes moveClouds { 
          0% { transform: translateX(-20px); } 
          50% { transform: translateX(5px); }
          100% { transform: translateX(-20px); }
        }
      `}
    </style>
    <circle cx="85" cy="15" r="10" className="sun" />
    <path d="M70 20 Q65 15 60 20 Q55 15 50 20 T40 20" className="cloud" style={{transform: 'translateX(-5px)'}} />
    <path d="M55 25 Q50 20 45 25 Q40 20 35 25 T25 25" className="cloud" />
    
    <path d="M5 30 L15 30 L20 20 L50 20 L55 30 L60 30 Q62 30 62 32 L62 40 Q62 42 60 42 L10 42 Q8 42 8 40 L8 32 Q8 30 10 30 Z" className="car-body" />
    <path d="M22 22 L48 22 L52 29 L25 29 Z" className="car-window" />
    <circle cx="18" cy="40" r="5" className="car-wheel" />
    <circle cx="52" cy="40" r="5" className="car-wheel" />
    <line x1="0" y1="48" x2="100" y2="48" className="road-line" />
  </svg>
);

const NoDriverFoundIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ width: '6rem', height: '6rem', margin: '1rem auto', display: 'block', ...style }}>
        <circle cx="32" cy="32" r="28" fill="#E0E0E0" />
        <path d="M20 20 L44 44 M44 20 L20 44" stroke="#757575" strokeWidth="4" strokeLinecap="round" />
        <circle cx="24" cy="28" r="2.5" fill="#757575" />
        <circle cx="40" cy="28" r="2.5" fill="#757575" />
        <path d="M26 40 Q32 35 38 40" fill="none" stroke="#757575" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

const RickshawIcon = ({ style }: { style?: CSSProperties }) => (
  <svg 
    viewBox="0 0 64 64" 
    xmlns="http://www.w3.org/2000/svg" 
    style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }} 
    aria-label="Rickshaw Icon"
  >
    <rect x="12" y="10" width="40" height="18" rx="4" fill="#FFC107" /> 
    <rect x="15" y="13" width="34" height="13" rx="2.5" fill="#81D4FA" stroke="#FFFFFF" strokeWidth="1.5" />
    <rect x="10" y="28" width="44" height="16" rx="4" fill="#FFA000" />
    <circle cx="19" cy="36" r="3.5" fill="#F44336" />
    <circle cx="19" cy="36" r="1.5" fill="#FFFFFF" />
    <circle cx="45" cy="36" r="3.5" fill="#F44336" />
    <circle cx="45" cy="36" r="1.5" fill="#FFFFFF" />
    <path d="M18 44 C16 44 15 45 15 47 L15 52 C15 54 16 55 18 55 L25 55 L25 59 L39 59 L39 55 L46 55 C48 55 49 54 49 52 L49 47 C49 45 48 44 46 44 Z" fill="#424242"/>
    <rect x="20" y="47" width="5" height="9" fill="#545454" rx="1"/> 
    <rect x="39" y="47" width="5" height="9" fill="#545454" rx="1"/>
    <circle cx="32" cy="56" r="5.5" fill="#545454"/> 
  </svg>
);

const TaxiIcon = ({ style }: { style?: CSSProperties }) => (
  <svg 
    viewBox="0 0 120 60" 
    xmlns="http://www.w3.org/2000/svg" 
    style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }} 
    aria-label="Taxi Icon"
  >
    <path d="M5 25 Q2 25 2 28 L2 40 Q2 43 5 43 L12 43 L15 50 Q16 52 18 52 L32 52 Q34 52 35 50 L38 43 L82 43 L85 50 Q86 52 88 52 L102 52 Q104 52 105 50 L108 43 L115 43 Q118 43 118 40 L118 28 Q118 25 115 25 L90 25 L85 15 Q83 12 80 12 L40 12 Q37 12 35 15 L30 25 Z" fill="#FFC107"/>
    <path d="M38 15 L78 15 Q80 15 81 17 L84 24 L36 24 L39 17 Q40 15 38 15 Z" fill="#333"/> 
    <path d="M41 24 L57 24 L57 16 L42 16 L41 18 Z" fill="#444" /> 
    <path d="M60 24 L79 24 L78 16 L61 16 L60 18 Z" fill="#444" /> 
    <circle cx="25" cy="46" r="8" fill="#333"/> <circle cx="25" cy="46" r="5" fill="#9E9E9E"/> <circle cx="25" cy="46" r="2" fill="#616161"/> 
    <circle cx="95" cy="46" r="8" fill="#333"/> <circle cx="95" cy="46" r="5" fill="#9E9E9E"/> <circle cx="95" cy="46" r="2" fill="#616161"/> 
    <rect x="45" y="6" width="30" height="7" rx="1" fill="#FFC107"/> <rect x="46" y="7" width="28" height="5" fill="#212121"/>
    <text x="60" y="11.5" fontFamily="Arial, sans-serif" fontSize="4.5" fill="white" textAnchor="middle" fontWeight="bold">TAXI</text>
    <rect x="47.5" y="7.5" width="1.5" height="1.5" fill="white"/> <rect x="49" y="7.5" width="1.5" height="1.5" fill="#212121"/>
    <rect x="47.5" y="9" width="1.5" height="1.5" fill="#212121"/> <rect x="49" y="9" width="1.5" height="1.5" fill="white"/>
    <text x="59" y="36" fontFamily="Arial, sans-serif" fontSize="5.5" fill="black" textAnchor="middle" fontWeight="bold">TAXI</text>
    {[0,1,2,3].map(i => <rect key={`fcheck1-${i}`} x={10 + i*2.5} y="27" width="2.5" height="2.5" fill={i%2 === 0 ? 'black' : 'white'} />)}
    {[0,1,2,3].map(i => <rect key={`fcheck2-${i}`} x={10 + i*2.5} y="29.5" width="2.5" height="2.5" fill={i%2 === 0 ? 'white' : 'black'} />)}
    {[0,1,2,3].map(i => <rect key={`rcheck1-${i}`} x={78 + i*2.5} y="27" width="2.5" height="2.5" fill={i%2 === 0 ? 'black' : 'white'} />)}
    {[0,1,2,3].map(i => <rect key={`rcheck2-${i}`} x={78 + i*2.5} y="29.5" width="2.5" height="2.5" fill={i%2 === 0 ? 'white' : 'black'} />)}
    <polygon points="5,26 10,26 12,29 10,32 5,32" fill="#E0E0E0"/>
    <polygon points="115,26 110,26 108,29 110,32 115,32" fill="#F44336"/>
    <rect x="39" y="32" width="8" height="1.5" rx="0.5" fill="#616161"/> <rect x="74" y="32" width="8" height="1.5" rx="0.5" fill="#616161"/>
  </svg>
);

const MotorcycleRickshawIcon = ({ style }: { style?: CSSProperties }) => {
  const primaryColor = "#009688"; const darkTeal = "#00796B"; const lightTeal = "#4DB6AC"; 
  const metalColor = "#9E9E9E"; const darkMetal = "#616161"; const tireColor = "#333333";
  const seatColor = "#424242"; const canopyFrameColor = "#212121"; 
  const headlightColor = "#FFEB3B"; const headlightAccent = "#FFFDE7";
  return (
    <svg viewBox="0 0 130 85" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }} aria-label="Cargo Rickshaw Icon">
      <circle cx="78" cy="70" r="10" fill={tireColor} /> <circle cx="78" cy="70" r="4" fill={darkMetal} />
      <circle cx="107" cy="70" r="10" fill={tireColor} /> <circle cx="107" cy="70" r="4" fill={darkMetal} />
      <rect x="65" y="40" width="60" height="25" fill={primaryColor} rx="2"/>
      <rect x="65" y="40" width="60" height="3" fill={darkTeal} /> <rect x="65" y="62" width="60" height="3" fill={darkTeal} />
      <rect x="65" y="40" width="3" height="25" fill={darkTeal} /> <rect x="122" y="40" width="3" height="25" fill={darkTeal} />
      <line x1="65" y1="52" x2="125" y2="52" stroke={darkTeal} strokeWidth="1.5" />
      <path d="M50 45 L65 45 L65 65 L45 65 Q40 65 40 60 L40 50 Q40 45 45 45 Z" fill={primaryColor} />
      <rect x="44" y="49" width="18" height="9" fill={seatColor} rx="1" />
      <rect x="35" y="12" width="50" height="18" fill={lightTeal} rx="3" stroke={canopyFrameColor} strokeWidth="1.5"/>
      <line x1="45" y1="30" x2="48" y2="46" stroke={canopyFrameColor} strokeWidth="2.5" /> 
      <line x1="78" y1="30" x2="63" y2="46" stroke={canopyFrameColor} strokeWidth="2.5" /> 
      <path d="M22 50 L50 50 L50 70 L22 70 Q17 70 17 65 L17 55 Q17 50 22 50 Z" fill={darkMetal} />
      <rect x="25" y="53" width="20" height="12" fill={metalColor} rx="2" /> 
      <circle cx="20" cy="70" r="10" fill={tireColor} /> <circle cx="20" cy="70" r="4" fill={darkMetal} />
      <path d="M8 70 Q20 55 32 70" fill="none" stroke={metalColor} strokeWidth="4.5" strokeLinecap="round"/>
      <line x1="40" y1="46" x2="35" y2="38" stroke={canopyFrameColor} strokeWidth="2.5" />
      <rect x="31" y="36" width="9" height="3.5" fill={canopyFrameColor} rx="1"/>
      <circle cx="15" cy="53" r="6" fill={headlightColor} stroke={darkMetal} strokeWidth="1"/>
      <circle cx="15" cy="53" r="3" fill={headlightAccent}/>
    </svg>
  );
};
const APP_USER_AGENT = 'RideHailingApp/1.0 (Development Build; +http://example.com/app-info)';
const PhoneInputScreen = ({ currentLang, onLangChange, onNext }: { currentLang: Language, onLangChange: (lang: Language) => void, onNext: (phoneNumber: string) => void }) => {
  const [phoneNumber, setPhoneNumber] = useState(''); const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false); const [isFocused, setIsFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); const dropdownRef = useRef<HTMLDivElement>(null);
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';
  const handleNextClick = () => { setError(''); if (!/^07[0-9]{8}$/.test(phoneNumber)) { setError(t.invalidPhoneError); return; } if (!termsAccepted) { setError(t.acceptTermsError); return; } onNext(phoneNumber); };
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) { setIsDropdownOpen(false); } }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
  const selectLang = (lang: Language) => { onLangChange(lang); setIsDropdownOpen(false); }
  const isNextDisabled = !termsAccepted || !(/^07[0-9]{8}$/.test(phoneNumber)) || !!error;
  const containerStyle: CSSProperties = { backgroundColor: 'white', padding: '2rem 2.5rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', width: '100%', maxWidth: '32rem', margin: '2rem auto', position: 'relative', boxSizing: 'border-box', paddingBottom: '7rem' };
  const langDropdownContainerStyle: CSSProperties = { position: 'absolute', top: '1rem', [isRTL ? 'left' : 'right']: '1rem', zIndex: 10 };
  const langButtonStyle: CSSProperties = { background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center' };
  const langButtonHoverStyle: CSSProperties = { color: '#0056b3' };
  const langMenuStyle: CSSProperties = { position: 'absolute', [isRTL ? 'left' : 'right']: 0, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '0.375rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', zIndex: 20, minWidth: '120px' };
  const langMenuItemStyle: CSSProperties = { padding: '0.625rem 1rem', cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap', textAlign: isRTL ? 'right' : 'left' };
  const langMenuItemHoverStyle: CSSProperties = { backgroundColor: '#F3F4F6' };
  const titleStyle: CSSProperties = { fontSize: '1.875rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.5rem', textAlign: 'center' };
  const subtitleStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563', marginBottom: '2rem', lineHeight: 1.6, textAlign: 'center' };
  const inputContainerStyle: CSSProperties = { position: 'relative', marginBottom: '0.5rem' };
  const inputBaseStyle: CSSProperties = { width: '100%', padding: '1.5rem 1rem 0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '1.125rem', outline: 'none', backgroundColor: 'transparent', transition: 'border-color 0.2s, box-shadow 0.2s', textAlign: isRTL ? 'right' : 'left', appearance: 'none' };
  const inputFocusStyle: CSSProperties = { borderColor: '#10B981', boxShadow: '0 0 0 1px #10B981' };
  const inputErrorStyle: CSSProperties = { borderColor: '#EF4444', boxShadow: '0 0 0 1px #EF4444' };
  const currentInputStyle = { ...inputBaseStyle, ...(isFocused ? inputFocusStyle : {}), ...(error && error === t.invalidPhoneError ? inputErrorStyle : {}) };
  const labelBaseStyle: CSSProperties = { position: 'absolute', [isRTL ? 'right' : 'left']: '1rem', padding: '0 0.25rem', transition: 'all 0.2s ease-out', pointerEvents: 'none', backgroundColor: 'white', color: '#6B7280' };
  const labelFloatingStyle: CSSProperties = { top: '-0.625rem', fontSize: '0.75rem' };
  const labelInitialStyle: CSSProperties = { top: '1rem', fontSize: '1rem' };
  const currentLabelStyle = { ...labelBaseStyle, ...((isFocused || phoneNumber) ? labelFloatingStyle : labelInitialStyle), color: isFocused ? '#059669' : (error && error === t.invalidPhoneError ? '#DC2626' : '#6B7280') };
  const errorMessageStyle: CSSProperties = { color: '#DC2626', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1rem', textAlign: isRTL ? 'right' : 'left', minHeight: '1.5em' };
  const termsContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '0.5rem', textAlign: isRTL ? 'right' : 'left' };
  const checkboxStyle: CSSProperties = { height: '1.25rem', width: '1.25rem', cursor: 'pointer', accentColor: '#10B981', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.25rem' };
  const termsLabelStyle: CSSProperties = { fontSize: '0.875rem', color: '#374151', cursor: 'pointer', flex: 1 };
  const nextButtonBaseStyle: CSSProperties = { position: 'absolute', bottom: '1.5rem', [isRTL ? 'right' : 'left']: '1.5rem', backgroundColor: '#10B981', color: 'white', width: '3.5rem', height: '3.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', transition: 'all 0.3s ease-in-out', zIndex: 10, border: 'none' };
  const nextButtonHoverStyle: CSSProperties = { backgroundColor: '#059669' };
  const nextButtonActiveStyle: CSSProperties = { transform: 'scale(0.95)' };
  const nextButtonDisabledStyle: CSSProperties = { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#9CA3AF' };
  const [isNextButtonHovered, setIsNextButtonHovered] = useState(false);
  let currentNextButtonStyle = {...nextButtonBaseStyle};
  if (isNextDisabled) currentNextButtonStyle = {...currentNextButtonStyle, ...nextButtonDisabledStyle};
  else if (isNextButtonHovered) currentNextButtonStyle = {...currentNextButtonStyle, ...nextButtonHoverStyle};
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value.replace(/[^0-9]/g, ''); setPhoneNumber(value); if (error === t.invalidPhoneError || error) { setError(''); } };
  const handleTermsChange = (e: React.ChangeEvent<HTMLInputElement>) => { setTermsAccepted(e.target.checked); if(error === t.acceptTermsError) { setError(''); } };
  return (
    <div style={containerStyle}>
      <div style={langDropdownContainerStyle} ref={dropdownRef}>
        <button style={langButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.color = langButtonHoverStyle.color!)} onMouseLeave={(e) => (e.currentTarget.style.color = langButtonStyle.color!)} onClick={() => setIsDropdownOpen(!isDropdownOpen)} aria-haspopup="true" aria-expanded={isDropdownOpen} aria-label="Select language">
          {translations[currentLang].languageName} <span style={{ display: 'inline-block', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', [isRTL ? 'marginRight' : 'marginLeft']: '0.35rem' }}>▼</span>
        </button>
        {isDropdownOpen && <div style={langMenuStyle}>{(Object.keys(translations) as Language[]).map((langKey) => (<div key={langKey} style={langMenuItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = langMenuItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = langMenuItemStyle.backgroundColor!} onClick={() => selectLang(langKey)}>{translations[langKey].languageName}</div>))}</div>}
      </div>
      <h1 style={titleStyle}>{t.welcomeTitle}</h1><p style={subtitleStyle}>{t.welcomeSubtitle}</p>
      <div style={inputContainerStyle}><input id="phone-input" type="tel" style={currentInputStyle} value={phoneNumber} onChange={handlePhoneInputChange} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} maxLength={10} aria-labelledby="phone-label" aria-invalid={!!(error && error === t.invalidPhoneError)} aria-describedby="phone-error-message" dir="ltr" /><label htmlFor="phone-input" id="phone-label" style={currentLabelStyle}>{t.mobileNumberLabel}</label></div>
      {error && error === t.invalidPhoneError && <p id="phone-error-message" style={errorMessageStyle} aria-live="assertive">{error}</p>} {!error && <div style={{...errorMessageStyle, visibility: 'hidden'}}>Placeholder</div>}
      <div style={termsContainerStyle}><input type="checkbox" id="terms-checkbox" style={checkboxStyle} checked={termsAccepted} onChange={handleTermsChange} aria-labelledby="terms-label" aria-describedby="terms-error-message" /><label htmlFor="terms-checkbox" id="terms-label" style={termsLabelStyle} dangerouslySetInnerHTML={{ __html: t.termsAcceptance }} /></div>
      {error && error === t.acceptTermsError && <p id="terms-error-message" style={{...errorMessageStyle, marginTop: '0', marginBottom: '1.5rem'}} aria-live="assertive">{error}</p>} {(!error || error !== t.acceptTermsError) && <div style={{...errorMessageStyle, visibility: 'hidden', marginTop: '0', marginBottom: '1.5rem'}}>Placeholder</div>}
      <button style={currentNextButtonStyle} onClick={handleNextClick} disabled={isNextDisabled} aria-label={t.nextButtonAriaLabel} onMouseEnter={() => setIsNextButtonHovered(true)} onMouseLeave={() => setIsNextButtonHovered(false)} onMouseDown={(e) => { if(!isNextDisabled) e.currentTarget.style.transform = nextButtonActiveStyle.transform!; }} onMouseUp={(e) => { if(!isNextDisabled) e.currentTarget.style.transform = 'scale(1)'; }}><RightArrowIcon style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}/></button>
    </div>
  );
};
const OtpScreen = ({ currentLang, phoneNumber, onConfirm, onResendOtp, onBack }: { currentLang: Language, phoneNumber: string, onConfirm: (otp: string) => void, onResendOtp: () => void, onBack: () => void }) => {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill('')); const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<number>(0); const inputRefs = useRef<(HTMLInputElement | null)[]>(new Array(6).fill(null));
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';
  useEffect(() => { inputRefs.current[0]?.focus(); setFocusedInput(0); }, []);
  const handleChange = (element: HTMLInputElement, index: number) => { const value = element.value.replace(/[^0-9]/g, ''); const newOtp = [...otp]; if (value) { newOtp[index] = value.slice(-1); setOtp(newOtp); if (index < 5 && value) inputRefs.current[index + 1]?.focus(); } else { newOtp[index] = ''; setOtp(newOtp); }};
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => { setError(''); if (e.key === 'Backspace') { e.preventDefault(); const newOtp = [...otp]; if (newOtp[index]) { newOtp[index] = ''; setOtp(newOtp); } else if (index > 0) inputRefs.current[index - 1]?.focus(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); if (isRTL) { if (index < 5) inputRefs.current[index + 1]?.focus(); } else { if (index > 0) inputRefs.current[index - 1]?.focus(); } } else if (e.key === 'ArrowRight') { e.preventDefault(); if (isRTL) { if (index > 0) inputRefs.current[index - 1]?.focus(); } else { if (index < 5) inputRefs.current[index + 1]?.focus(); } } else if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } else if (!/[0-9]/.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== 'Tab') e.preventDefault(); };
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, ''); if (pasteData.length > 0) { const newOtp = new Array(6).fill(''); for (let i = 0; i < pasteData.length && i < 6; i++) newOtp[i] = pasteData[i]; setOtp(newOtp); const lastFilledIndex = Math.min(pasteData.length, 6) -1; if (lastFilledIndex >=0 && lastFilledIndex < 5) inputRefs.current[lastFilledIndex + 1]?.focus(); else if (lastFilledIndex === 5) inputRefs.current[5]?.focus(); else if (pasteData.length > 0 && pasteData.length <=6) inputRefs.current[pasteData.length]?.focus(); else inputRefs.current[0]?.focus(); }};
  const handleSubmit = () => { const otpCode = otp.join(''); if (otpCode.length === 6 && otp.every(digit => digit !== '')) { setError(''); onConfirm(otpCode); } else { setError(t.invalidOtpError); const firstEmptyOrInvalid = otp.findIndex(digit => !/^[0-9]$/.test(digit)); if (firstEmptyOrInvalid !== -1) inputRefs.current[firstEmptyOrInvalid]?.focus(); else inputRefs.current[0]?.focus(); }};
  const [timer, setTimer] = useState(60); const [canResend, setCanResend] = useState(false);
  useEffect(() => { let interval: number | undefined; if (timer > 0 && !canResend) interval = window.setInterval(() => { setTimer(prevTimer => prevTimer - 1); }, 1000); else if (timer === 0 && !canResend) { setCanResend(true); setTimer(0); } return () => clearInterval(interval); }, [timer, canResend]);
  const handleResendClick = () => { onResendOtp(); setOtp(new Array(6).fill('')); setError(''); setTimer(60); setCanResend(false); inputRefs.current[0]?.focus(); };
  const containerStyle: CSSProperties = { backgroundColor: 'white', padding: '2rem 2.5rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', width: '100%', maxWidth: '32rem', margin: '2rem auto', position: 'relative', boxSizing: 'border-box', textAlign: 'center' };
  const titleStyle: CSSProperties = { fontSize: '1.875rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.5rem' };
  const subtitleStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563', marginBottom: '0.75rem', lineHeight: 1.6 };
  const changeNumberContainerStyle: CSSProperties = { marginBottom: '1.5rem' };
  const changeNumberButtonStyle: CSSProperties = { color: '#059669', fontSize: '0.875rem', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', padding: '0.25rem' };
  const changeNumberButtonHoverStyle: CSSProperties = { textDecoration: 'underline' };
  const otpInputsContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', direction: 'ltr' };
  const otpInputBaseStyle: CSSProperties = { width: '3.25rem', height: '3.75rem', textAlign: 'center', fontSize: '1.25rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', color: '#374151', caretColor: '#10B981', appearance: 'none' };
  const otpInputFocusStyle: CSSProperties = { borderColor: '#10B981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.5)' };
  const errorMessageStyle: CSSProperties = { color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem', minHeight: '1.5em' };
  const resendContainerStyle: CSSProperties = { marginBottom: '1.25rem', fontSize: '0.875rem', color: '#4B5563', height: '1.25rem' };
  const resendButtonStyle: CSSProperties = { color: '#059669', fontWeight: 500, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' };
  const resendButtonHoverStyle: CSSProperties = { color: '#047857' };
  const confirmButtonStyle: CSSProperties = { width: '100%', background: 'linear-gradient(to right, #10B981, #059669)', color: 'white', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontSize: '1.125rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.3s ease-in-out' };
  const confirmButtonHoverStyle: CSSProperties = { background: 'linear-gradient(to right, #059669, #047857)' };
  const [isConfirmHovered, setIsConfirmHovered] = useState(false); const [isResendHovered, setIsResendHovered] = useState(false); const [isChangeNumHovered, setIsChangeNumHovered] = useState(false);
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>{t.otpScreenTitle}</h1> <p style={subtitleStyle}>{t.otpScreenSubtitle.replace('{phoneNumber}', phoneNumber)}</p>
      <div style={changeNumberContainerStyle}><button onClick={onBack} style={isChangeNumHovered ? {...changeNumberButtonStyle, ...changeNumberButtonHoverStyle} : changeNumberButtonStyle} onMouseEnter={() => setIsChangeNumHovered(true)} onMouseLeave={() => setIsChangeNumHovered(false)}>({t.changeNumber})</button></div>
      <div style={otpInputsContainerStyle} onPaste={handlePaste}>{otp.map((data, index) => (<input key={index} type="tel" name={`otp-${index}`} style={focusedInput === index ? {...otpInputBaseStyle, ...otpInputFocusStyle} : otpInputBaseStyle} value={data} onChange={(e) => handleChange(e.target, index)} onKeyDown={(e) => handleKeyDown(e, index)} onFocus={() => setFocusedInput(index)} maxLength={1} ref={(el) => { inputRefs.current[index] = el; }} aria-label={`OTP digit ${index + 1}`} autoComplete="off" />))}</div>
      {error && <p style={errorMessageStyle} aria-live="assertive">{error}</p>} {!error && <div style={{...errorMessageStyle, visibility: 'hidden'}}>Placeholder</div>}
      <div style={resendContainerStyle}>{canResend ? (<button onClick={handleResendClick} style={isResendHovered ? {...resendButtonStyle, ...resendButtonHoverStyle} : resendButtonStyle} onMouseEnter={() => setIsResendHovered(true)} onMouseLeave={() => setIsResendHovered(false)} aria-live="polite">{t.resendOtp}</button>) : (<span aria-live="polite">{t.resendOtpCountdown.replace('{timer}', String(timer))}</span>)}</div>
      <button id="confirm-otp-button" style={isConfirmHovered ? {...confirmButtonStyle, ...confirmButtonHoverStyle} : confirmButtonStyle} onMouseEnter={() => setIsConfirmHovered(true)} onMouseLeave={() => setIsConfirmHovered(false)} onClick={handleSubmit}>{t.confirmOtpButton}</button>
    </div>
  );
};
interface Service { id: string; nameKey: keyof typeof translations.fa; descKey: keyof typeof translations.fa; price?: number; pricePerKm?: number; imageComponent: React.FC<{ style?: CSSProperties }>; }
interface ServiceCategory { id: string; nameKey: keyof typeof translations.fa; services: Service[]; }
const serviceData: ServiceCategory[] = [ { id: 'passenger', nameKey: 'serviceCategoryPassenger', services: [ { id: 'rickshaw', nameKey: 'serviceNameRickshaw', descKey: 'serviceDescRickshaw', pricePerKm: 10, imageComponent: RickshawIcon }, { id: 'car', nameKey: 'serviceNameCar', descKey: 'serviceDescCar', pricePerKm: 15, imageComponent: TaxiIcon }, ] }, { id: 'cargo', nameKey: 'serviceCategoryCargo', services: [ { id: 'cargoRickshaw', nameKey: 'serviceNameCargoRickshaw', descKey: 'serviceDescCargoRickshaw', pricePerKm: 20, imageComponent: MotorcycleRickshawIcon }, ] }, { id: 'courier', nameKey: 'serviceCategoryCourier', services: [] } ];
interface ServiceSelectionSheetProps { currentLang: Language; originAddress: string; destinationAddress: string; routeDistanceKm: number | null; isCalculatingDistance: boolean; distanceError: string | null; onRequestRide: (service: Service, estimatedPrice: number | null) => void; }
const ServiceSelectionSheet: React.FC<ServiceSelectionSheetProps> = ({ currentLang, originAddress, destinationAddress, routeDistanceKm, isCalculatingDistance, distanceError, onRequestRide }) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';
  const [activeCategoryId, setActiveCategoryId] = useState<string>(serviceData[0]?.id || 'passenger');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>( serviceData.find(cat => cat.id === (serviceData[0]?.id || 'passenger'))?.services[0]?.id || null );
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; } }, []);
  const handleRequestClick = () => { const activeCategory = serviceData.find(cat => cat.id === activeCategoryId); const service = activeCategory?.services.find(s => s.id === selectedServiceId); if (service) { let estimatedPrice: number | null = null; if (service.pricePerKm && routeDistanceKm !== null) { estimatedPrice = Math.round(service.pricePerKm * routeDistanceKm); } else if (service.price) { estimatedPrice = Math.round(service.price); } onRequestRide(service, estimatedPrice); } else { alert(t.selectServicePrompt); } };
  const activeCategoryServices = serviceData.find(cat => cat.id === activeCategoryId)?.services || [];
  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', maxHeight: '70vh', display: 'flex', flexDirection: 'column', transform: 'translateY(100%)', transition: 'transform 0.3s ease-out', zIndex: 1100, direction: isRTL ? 'rtl' : 'ltr', };
  const tabsContainerStyle: CSSProperties = { display: 'flex', borderBottom: '1px solid #e0e0e0', marginBottom: '1rem', flexShrink: 0, };
  const tabStyle = (isActive: boolean): CSSProperties => ({ padding: '0.75rem 1rem', cursor: 'pointer', color: isActive ? '#10B981' : '#555', fontWeight: isActive ? 'bold' : 'normal', borderBottom: isActive ? '3px solid #10B981' : '3px solid transparent', transition: 'color 0.2s, border-bottom 0.2s', fontSize: '0.9rem', textAlign: 'center', flexGrow: 1, });
  const serviceListStyle: CSSProperties = { overflowY: 'auto', flexGrow: 1, paddingRight: isRTL ? 0 : '0.5rem', paddingLeft: isRTL ? '0.5rem' : 0, };
  const serviceItemStyle = (isSelected: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '0.5rem', backgroundColor: isSelected ? '#e6f7f0' : 'transparent', border: isSelected ? '1px solid #10B981' : '1px solid #eee', cursor: 'pointer', transition: 'background-color 0.2s, border-color 0.2s', });
  const serviceItemImageStyle: CSSProperties = { width: '3.5rem', height: '3.5rem', [isRTL ? 'marginLeft' : 'marginRight']: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const serviceItemDetailsStyle: CSSProperties = { flexGrow: 1 }; const serviceItemNameStyle: CSSProperties = { fontWeight: 'bold', fontSize: '1rem', color: '#333' }; const serviceItemDescStyle: CSSProperties = { fontSize: '0.8rem', color: '#777' }; const serviceItemPriceStyle: CSSProperties = { fontSize: '1rem', fontWeight: 'bold', color: '#10B981', whiteSpace: 'nowrap' }; const priceLoadingErrorStyle: CSSProperties = { fontSize: '0.85rem', color: '#777', whiteSpace: 'nowrap', textAlign: isRTL ? 'left' : 'right' };
  const optionsContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '1px solid #e0e0e0', marginTop: 'auto', flexShrink: 0, };
  const optionItemStyle: CSSProperties = { display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#555', cursor: 'pointer', opacity: 0.7, }; const optionIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem', color: '#10B981' };
  const footerStyle: CSSProperties = { display: 'flex', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #e0e0e0', flexShrink: 0, };
  const requestButtonStyle: CSSProperties = { flexGrow: 1, backgroundColor: '#10B981', color: 'white', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', textAlign: 'center', opacity: selectedServiceId ? 1 : 0.6, }; const requestButtonDisabledStyle: CSSProperties = { backgroundColor: '#9CA3AF', cursor: 'not-allowed' };
  const scheduleButtonStyle: CSSProperties = { background: 'none', border: '1px solid #ccc', borderRadius: '0.5rem', padding: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', [isRTL ? 'marginRight' : 'marginLeft']: '0.75rem', opacity: 0.7, };
  return ( <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="service-sheet-title"> <div style={tabsContainerStyle}> {serviceData.map(category => ( <button key={category.id} style={tabStyle(category.id === activeCategoryId)} onClick={() => { setActiveCategoryId(category.id); const firstServiceInNewCategory = serviceData.find(cat => cat.id === category.id)?.services[0]; setSelectedServiceId(firstServiceInNewCategory?.id || null); }} role="tab" aria-selected={category.id === activeCategoryId} > {t[category.nameKey] || category.id} </button> ))} </div> <div style={serviceListStyle}> {activeCategoryServices.length > 0 ? activeCategoryServices.map(service => { const ServiceImage = service.imageComponent; let priceDisplay: React.ReactNode; if (isCalculatingDistance) { priceDisplay = <div style={priceLoadingErrorStyle}>{t.calculatingPrice}</div>; } else if (distanceError) { priceDisplay = <div style={{...priceLoadingErrorStyle, color: 'red'}}>{distanceError}</div>; } else if (service.pricePerKm && routeDistanceKm !== null) { const estimatedPrice = Math.round(service.pricePerKm * routeDistanceKm);
            priceDisplay = <div style={serviceItemPriceStyle}>{`${estimatedPrice.toLocaleString(currentLang === 'fa' || currentLang === 'ps' ? 'fa-IR' : 'en-US')} ${t.priceUnit}`}</div>; } else if (service.price) { const fixedPrice = Math.round(service.price);
            priceDisplay = <div style={serviceItemPriceStyle}>{`${fixedPrice.toLocaleString(currentLang === 'fa' || currentLang === 'ps' ? 'fa-IR' : 'en-US')} ${t.priceUnit}`}</div>; } else { priceDisplay = <div style={priceLoadingErrorStyle}>-</div>; } return ( <div key={service.id} style={serviceItemStyle(service.id === selectedServiceId)} onClick={() => setSelectedServiceId(service.id)} role="radio" aria-checked={service.id === selectedServiceId} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedServiceId(service.id); }} > <div style={serviceItemImageStyle}><ServiceImage style={{width: '90%', height: '90%'}} /></div> <div style={serviceItemDetailsStyle}> <div style={serviceItemNameStyle}>{t[service.nameKey] || service.id}</div> <div style={serviceItemDescStyle}>{t[service.descKey]}</div> </div> {priceDisplay} </div> ) }) : <p style={{textAlign: 'center', color: '#777', padding: '1rem'}}>No services available in this category.</p>} </div> <div style={optionsContainerStyle}> <div style={optionItemStyle} role="button" tabIndex={0} aria-disabled="true"> <FilterIcon style={optionIconStyle} /> {t.rideOptions} </div> <div style={optionItemStyle} role="button" tabIndex={0} aria-disabled="true"> <TagIcon style={optionIconStyle} /> {t.coupon} </div> </div> <div style={footerStyle}> <button style={{...requestButtonStyle, ...( !selectedServiceId || isCalculatingDistance || distanceError ? requestButtonDisabledStyle : {})}} onClick={handleRequestClick} disabled={!selectedServiceId || isCalculatingDistance || !!distanceError} > {t.requestRideButtonText} </button> <button style={scheduleButtonStyle} aria-label={t.scheduledRideButtonAriaLabel} disabled={true}> <ScheduledRideIcon style={{ color: '#555'}}/> </button> </div> </div> );
};
type DriverSearchState = 'idle' | 'searching' | 'noDriverFound' | 'driversNotified' | 'driverAssigned';
interface DriverSearchSheetProps { currentLang: Language; searchState: DriverSearchState; notifiedDriverCount: number; onRetry: () => void; onCancel: () => void; onClose: () => void; }
const DriverSearchSheet: React.FC<DriverSearchSheetProps> = ({ currentLang, searchState, notifiedDriverCount, onRetry, onCancel, onClose }) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en'; const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; } }, []);
  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '1.5rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', minHeight: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'translateY(100%)', transition: 'transform 0.3s ease-out', zIndex: 1200, direction: isRTL ? 'rtl' : 'ltr', textAlign: 'center', };
  const titleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 'bold', color: '#333', marginBottom: '1rem', }; const messageStyle: CSSProperties = { fontSize: '1rem', color: '#555', marginBottom: '1.5rem', lineHeight: 1.6, }; const buttonContainerStyle: CSSProperties = { display: 'flex', gap: '1rem', width: '100%', maxWidth: '300px', marginTop: '1rem', }; const actionButtonStyle: CSSProperties = { flexGrow: 1, padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', }; const primaryButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#10B981', color: 'white' }; const secondaryButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#e0e0e0', color: '#333' };
  const closeButtonStyle: CSSProperties = { position: 'absolute', top: '1rem', [isRTL ? 'left' : 'right']: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' };
  let content;
  switch (searchState) {
    case 'searching': content = ( <> <SearchingCarAnimationIcon /> <p style={messageStyle}>{t.searchingForDriver}</p> <button style={{...secondaryButtonStyle, marginTop: '1rem', width: '80%', maxWidth: '250px'}} onClick={onCancel}> {t.cancelButton} </button> </> ); break;
    case 'noDriverFound': content = ( <> <NoDriverFoundIcon /> <h2 style={titleStyle}>{t.noDriverFoundError}</h2> <div style={buttonContainerStyle}> <button style={secondaryButtonStyle} onClick={onCancel}>{t.cancelButton}</button> <button style={primaryButtonStyle} onClick={onRetry}><RetryIcon style={{verticalAlign: 'middle', [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem'}} />{t.tryAgainButton}</button> </div> </> ); break;
    case 'driversNotified': content = ( <> <SearchingCarAnimationIcon /> <p style={messageStyle}> {t.driversNotifiedMessage.replace('{count}', String(notifiedDriverCount))} </p> <button style={{...secondaryButtonStyle, marginTop: '1rem', width: '80%', maxWidth: '250px'}} onClick={onCancel}> {t.cancelButton} </button> </> ); break;
    default: content = null;
  }
  return ( <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="driver-search-title"> <button style={closeButtonStyle} onClick={onClose} aria-label={t.closeDriverSearchSheetAriaLabel}> <CloseIcon style={{color: '#777'}}/> </button> {content} </div> );
};

// --- StarRating Component ---
interface StarRatingProps {
    currentLang: Language;
    count: number;
    rating: number;
    onRatingChange: (rating: number) => void;
    hoverRating: number;
    onHoverRatingChange: (hoverRating: number) => void;
}
const StarRating: React.FC<StarRatingProps> = ({ currentLang, count, rating, onRatingChange, hoverRating, onHoverRatingChange }) => {
    const t = translations[currentLang];
    const stars = Array.from({ length: count }, (_, i) => i + 1);
    const starContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'center', marginBottom: '1rem' };
    return (
        <div style={starContainerStyle} role="radiogroup" aria-label={t.rateDriverPrompt}>
            {stars.map((starValue) => (
                <StarIcon
                    key={starValue}
                    filled={(hoverRating || rating) >= starValue}
                    onClick={() => onRatingChange(starValue)}
                    onMouseEnter={() => onHoverRatingChange(starValue)}
                    onMouseLeave={() => onHoverRatingChange(0)}
                    ariaLabel={t.starAriaLabel.replace('{index}', String(starValue))}
                />
            ))}
        </div>
    );
};

// --- TripInProgressSheet Component ---
interface DriverDetails {
  name: string;
  serviceId: 'rickshaw' | 'car' | 'cargoRickshaw' | string; 
  vehicleColor: string;
  plateParts: { region: string; numbers: string; type: string };
  profilePicUrl?: string;
}

type TripPhase = 'enRouteToOrigin' | 'enRouteToDestination' | 'arrivedAtDestination' | null;
type TripSheetDisplayLevel = 'peek' | 'default' | 'full';

interface TripInProgressSheetProps {
  currentLang: Language;
  driverDetails: DriverDetails;
  tripFare: number | null; 
  tripPhase: TripPhase;
  estimatedTimeToDestination: number | null;
  displayLevel: TripSheetDisplayLevel;
  onToggleDisplayLevel: () => void;
  onCallDriver: () => void;
  onMessageDriver: () => void;
  onPayment: () => void;
  onChangeDestination: () => void;
  onApplyCoupon: () => void;
  onRideOptions: () => void;
  onCancelTrip: () => void;
  onSafety: () => void;
  onClose: () => void; 
}

const TripInProgressSheet: React.FC<TripInProgressSheetProps> = ({
  currentLang, driverDetails, tripFare, tripPhase, estimatedTimeToDestination,
  displayLevel, onToggleDisplayLevel, onCallDriver, onMessageDriver, onPayment,
  onChangeDestination, onApplyCoupon, onRideOptions, onCancelTrip, onSafety, onClose
}) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => { if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; } }, []);
  useEffect(() => { if (tripPhase === 'arrivedAtDestination') setCurrentRating(0); }, [tripPhase]);


  const service = serviceData.flatMap(cat => cat.services).find(s => s.id === driverDetails.serviceId);
  const serviceName = service ? t[service.nameKey] : driverDetails.serviceId;
  const vehicleDescription = `${serviceName} - ${driverDetails.vehicleColor}`;

  let sheetTitleText = t.driverAssignedTitle;
  if (tripPhase === 'enRouteToDestination') { sheetTitleText = t.tripInProgressTitle;
  } else if (tripPhase === 'arrivedAtDestination') { sheetTitleText = t.tripEndedSuccessfullyTitle; }

  const tripStatusMessage = tripPhase === 'enRouteToDestination' ? t.enRouteToDestinationStatus : null;

  const getSheetHeight = () => {
    if (tripPhase === 'arrivedAtDestination') return 'auto'; // For rating content
    if (displayLevel === 'peek') return '180px';
    if (displayLevel === 'default') return '320px';
    if (displayLevel === 'full') return '85vh';
    return '320px'; // Fallback
  };

  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '0.75rem 1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', transform: 'translateY(100%)', transition: 'transform 0.3s ease-out, height 0.3s ease-out', zIndex: 1250, direction: isRTL ? 'rtl' : 'ltr', height: getSheetHeight(), maxHeight: '85vh', overflow: displayLevel === 'full' && tripPhase !== 'arrivedAtDestination' ? 'hidden' : 'visible' }; // overflow hidden only for full view to allow internal scroll
  const handleStyle: CSSProperties = { width: '40px', height: '4px', backgroundColor: '#ccc', borderRadius: '2px', margin: '0.25rem auto 0.5rem', cursor: 'pointer', flexShrink: 0, };
  const topContentStyle: CSSProperties = { padding: '0 0.5rem', flexShrink: 0, overflowY: displayLevel === 'peek' || displayLevel === 'default' ? 'hidden' : 'auto' };
  const sheetTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: '0.25rem' };
  const tripStatusMessageStyle: CSSProperties = { fontSize: '0.85rem', color: '#059669', textAlign: 'center', marginBottom: '0.75rem', fontWeight: 500 };
  const driverInfoContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '0.75rem', };
  const driverImageStyle: CSSProperties = { width: displayLevel === 'peek' ? '3rem' : '4rem', height: displayLevel === 'peek' ? '3rem' : '4rem', borderRadius: '50%', backgroundColor: '#e0e0e0', [isRTL ? 'marginLeft' : 'marginRight']: '1rem', objectFit: 'cover', transition: 'width 0.3s, height 0.3s' };
  const driverTextInfoStyle: CSSProperties = { flexGrow: 1 };
  const driverNameStyle: CSSProperties = { fontSize: displayLevel === 'peek' ? '1rem':'1.1rem', fontWeight: 'bold', color: '#333' };
  const carModelStyle: CSSProperties = { fontSize: displayLevel === 'peek' ? '0.8rem':'0.9rem', color: '#555', marginTop: '0.1rem' };
  const plateContainerStyle: CSSProperties = { marginTop: '0.25rem', transform: displayLevel === 'peek' ? 'scale(0.9)' : 'scale(1)', transformOrigin: isRTL ? 'right' : 'left', transition: 'transform 0.3s' };
  const actionButtonsContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-around', marginBottom: '0.75rem', };
  const contactButtonStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#007bff', fontSize: '0.8rem', padding: '0.5rem' };
  const contactButtonIconStyle: CSSProperties = { marginBottom: '0.25rem', fontSize: '1.5rem' };
  const etaAndFareContainer: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.5rem', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '0.75rem' };
  const etaContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#555' };
  const etaIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.35rem', color: '#555'};
  const fareInfoStyle: CSSProperties = { fontSize: '0.9rem', color: '#333', textAlign: isRTL ? 'left' : 'right' };
  const fareAmountStyle: CSSProperties = { fontWeight: 'bold', color: '#10B981' };
  const insufficientBalanceStyle: CSSProperties = { fontSize: '0.75rem', color: 'red', marginTop: '0.1rem', textAlign: isRTL ? 'left' : 'right' };
  const payButtonStyle: CSSProperties = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' };
  const expandedContentStyle: CSSProperties = { flexGrow: 1, overflowY: 'auto', padding: '0 0.5rem', display: displayLevel === 'full' ? 'block' : 'none' };
  const optionListItemStyle: CSSProperties = { display: 'flex', alignItems: 'center', padding: '0.85rem 0.25rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '0.95rem', color: '#333' };
  const optionListItemIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', color: '#555', fontSize: '1.1rem' };
  const optionListItemTextStyle: CSSProperties = { flexGrow: 1 };
  const changeDestinationButtonStyle: CSSProperties = { ...optionListItemStyle, backgroundColor: tripPhase === 'enRouteToDestination' ? '#e6f7f0' : undefined, border: tripPhase === 'enRouteToDestination' ? '1px solid #10b981' : optionListItemStyle.borderBottom, borderRadius: tripPhase === 'enRouteToDestination' ? '0.375rem' : undefined, marginBottom: tripPhase === 'enRouteToDestination' ? '0.5rem' : undefined, marginTop: tripPhase === 'enRouteToDestination' ? '0.25rem' : undefined };
  const cancelRideListItemStyle: CSSProperties = { ...optionListItemStyle, color: '#D32F2F' };
  const cancelRideIconStyle: CSSProperties = { ...optionListItemIconStyle, color: '#D32F2F' };

  const ratingPromptStyle: CSSProperties = { textAlign: 'center', fontSize: '1rem', color: '#333', margin: '1rem 0 0.5rem 0' };
  const ratingButtonContainerStyle: CSSProperties = { display: 'flex', gap: '1rem', marginTop: '1rem', padding: '0 0.5rem' };
  const ratingSubmitButtonStyle: CSSProperties = { flex: 1, padding: '0.75rem', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', opacity: currentRating > 0 ? 1 : 0.5 };
  const ratingSkipButtonStyle: CSSProperties = { flex: 1, padding: '0.75rem', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '0.375rem', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' };

  const handleRatingSubmit = () => {
    console.log(`Driver rated: ${currentRating} stars`);
    onClose(); // Reset the app for new trip
  };

  const mainContentVisible = displayLevel !== 'peek' || tripPhase === 'arrivedAtDestination';

  return (
    <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="trip-sheet-title">
      <div style={handleStyle} onClick={onToggleDisplayLevel} onTouchStart={onToggleDisplayLevel} role="button" aria-label={t.pullUpForDetails}></div>
      <div style={topContentStyle}>
        <h2 id="trip-sheet-title" style={sheetTitleStyle}>{sheetTitleText}</h2>
        
        {tripPhase !== 'arrivedAtDestination' ? (
            <>
                {tripStatusMessage && mainContentVisible && <p style={tripStatusMessageStyle}>{tripStatusMessage}</p>}
                <div style={driverInfoContainerStyle}>
                <img src={driverDetails.profilePicUrl || `https://ui-avatars.com/api/?name=${driverDetails.name.replace(' ', '+')}&background=random&size=128`} alt={driverDetails.name} style={driverImageStyle} />
                <div style={driverTextInfoStyle}>
                    <div style={driverNameStyle}>{driverDetails.name}</div>
                    { (displayLevel !== 'peek' || !tripStatusMessage) && <div style={carModelStyle}>{vehicleDescription}</div> }
                    { mainContentVisible && <div style={plateContainerStyle}><LicensePlateAFGIcon plateParts={driverDetails.plateParts} /></div> }
                </div>
                </div>
                {mainContentVisible && (
                    <>
                        <div style={actionButtonsContainerStyle}>
                        <button style={contactButtonStyle} onClick={onCallDriver}><PhoneIcon style={contactButtonIconStyle}/> {t.callDriverButton}</button>
                        <button style={contactButtonStyle} onClick={onMessageDriver}><MessageBubbleIcon style={contactButtonIconStyle}/> {t.messageDriverButton}</button>
                        </div>
                        <div style={etaAndFareContainer}>
                            <div>
                            <div style={fareInfoStyle}>
                                {t.fareLabel}{' '}
                                {tripFare !== null ? (
                                <span style={fareAmountStyle}>
                                    {Math.round(tripFare).toLocaleString(currentLang === 'fa' || currentLang === 'ps' ? 'fa-IR' : 'en-US')}{' '}
                                    {t.priceUnit}
                                </span>
                                ) : (
                                <span style={fareAmountStyle}>{t.fareNotAvailable}</span>
                                )}
                            </div>
                            <div style={insufficientBalanceStyle}>{t.insufficientBalance}</div>
                            </div>
                        {tripPhase === 'enRouteToDestination' && estimatedTimeToDestination !== null && estimatedTimeToDestination > 0 && (
                            <div style={etaContainerStyle}>
                            <ClockIcon style={etaIconStyle} />
                            {t.etaLabel} {estimatedTimeToDestination} {t.etaUnitMinutes}
                            </div>
                        )}
                        </div>
                        <div style={{display: 'flex', justifyContent:'center', paddingBottom: '0.5rem'}}>
                            <button style={{...payButtonStyle, display: tripPhase !== 'enRouteToDestination' ? 'block' : 'none' }} onClick={onPayment}>{t.payButton}</button>
                        </div>
                    </>
                )}
            </>
        ) : ( // arrivedAtDestination
            <div style={{padding: '1rem 0', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <p style={ratingPromptStyle}>{t.rateDriverPrompt}</p>
                <StarRating 
                    currentLang={currentLang}
                    count={5} 
                    rating={currentRating} 
                    onRatingChange={setCurrentRating}
                    hoverRating={hoverRating}
                    onHoverRatingChange={setHoverRating}
                />
                <div style={ratingButtonContainerStyle}>
                    <button style={ratingSkipButtonStyle} onClick={onClose}>{t.skipRatingButton}</button>
                    <button style={{...ratingSubmitButtonStyle, opacity: currentRating > 0 ? 1 : 0.6}} onClick={handleRatingSubmit} disabled={currentRating === 0}>{t.submitRatingButton}</button>
                </div>
            </div>
        )}
      </div>

      {tripPhase !== 'arrivedAtDestination' && (
        <div style={expandedContentStyle}>
          <div style={changeDestinationButtonStyle} onClick={onChangeDestination} role="button"> <EditLocationIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.changeDestinationButton}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={optionListItemStyle} onClick={onApplyCoupon} role="button"> <TagIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.coupon}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={optionListItemStyle} onClick={onRideOptions} role="button"> <RideOptionsIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.rideOptionsButton}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={optionListItemStyle} onClick={onSafety} role="button"> <SafetyShieldIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.safetyButton}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={cancelRideListItemStyle} onClick={onCancelTrip} role="button"> <CancelRideIcon style={cancelRideIconStyle} /> <span style={optionListItemTextStyle}>{t.cancelRideButton}</span> <RightArrowIcon style={{color: '#D32F2F', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
        </div>
      )}
    </div>
  );
};


function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: number | undefined = undefined;
  return (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => { clearTimeout(timeoutId); return new Promise<Awaited<ReturnType<F>>>((resolve, reject) => { timeoutId = window.setTimeout(async () => { try { const result = await func(...args); resolve(result); } catch (e) { reject(e); } }, waitFor); }); };
}

const MapScreen = ({ currentLang }: { currentLang: Language }) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';
  const mapContainerRef = useRef<HTMLDivElement>(null); const mapInstanceRef = useRef<L.Map | null>(null);
  const fixedMarkerRef = useRef<HTMLDivElement>(null);
  const [selectionMode, setSelectionMode] = useState<'origin' | 'destination'>('origin');
  const [confirmedOrigin, setConfirmedOrigin] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [confirmedDestination, setConfirmedDestination] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [address, setAddress] = useState<string>(''); const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true); const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [serviceFor, setServiceFor] = useState<'self' | 'other'>('self');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false); const serviceDropdownRef = useRef<HTMLDivElement>(null);
  const [showServiceSheet, setShowServiceSheet] = useState<boolean>(false);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState<boolean>(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [showDriverSearchSheet, setShowDriverSearchSheet] = useState<boolean>(false);
  const [driverSearchState, setDriverSearchState] = useState<DriverSearchState>('idle');
  const [notifiedDriverCount, setNotifiedDriverCount] = useState<number>(0);
  const [selectedServiceForSearch, setSelectedServiceForSearch] = useState<Service | null>(null);
  const searchIntervalIdRef = useRef<number | null>(null);
  const [showTripInProgressSheet, setShowTripInProgressSheet] = useState<boolean>(false);
  const [tripSheetDisplayLevel, setTripSheetDisplayLevel] = useState<TripSheetDisplayLevel>('peek');
  const [currentTripFare, setCurrentTripFare] = useState<number | null>(null);

  const [originMapMarker, setOriginMapMarker] = useState<L.Marker | null>(null);
  const [destinationMapMarker, setDestinationMapMarker] = useState<L.Marker | null>(null);
  const [driverMarker, setDriverMarker] = useState<L.Marker | null>(null);
  const [driverLocation, setDriverLocation] = useState<L.LatLng | null>(null);
  
  const [tripPhase, setTripPhase] = useState<TripPhase>(null);
  const [estimatedTimeToDestination, setEstimatedTimeToDestination] = useState<number | null>(null);
  const simToOriginIntervalIdRef = useRef<number | null>(null);
  const simToDestinationIntervalIdRef = useRef<number | null>(null);


  const mockDriverData: DriverDetails = {
    name: "مصیب بیات",
    serviceId: 'car', 
    vehicleColor: "سفید", 
    plateParts: { region: "کابل", numbers: "۳۴۵۶۷", type: "ش" }, 
    profilePicUrl: "https://randomuser.me/api/portraits/men/32.jpg",
  };
  
  const debouncedUpdateAddressRef = useRef<((map: L.Map) => Promise<void>) | undefined>(undefined);
  const updateAddressFromMapCenter = useCallback(async (map: L.Map) => {
    if (showDriverSearchSheet || showTripInProgressSheet) return; setIsLoadingAddress(true); setSearchQuery(t.addressLoading); setSearchError(''); const center = map.getCenter();
    try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&accept-language=${currentLang}&zoom=18`, { headers: { 'User-Agent': APP_USER_AGENT } }); if (!response.ok) throw new Error('Network response was not ok'); const data = await response.json(); if (data && data.display_name) { setAddress(data.display_name); setSearchQuery(data.display_name); } else { setAddress(t.addressNotFound); setSearchQuery(t.addressNotFound); } } catch (error) { console.error("Error fetching address:", error); setAddress(t.addressError); setSearchQuery(t.addressError); } finally { setIsLoadingAddress(false); }
  }, [currentLang, t.addressLoading, t.addressNotFound, t.addressError, showDriverSearchSheet, showTripInProgressSheet]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !mapInstanceRef.current || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) return; setIsSearching(true); setSearchError(''); const map = mapInstanceRef.current;
    try { const bounds = map.getBounds(); const viewbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`; const response = await fetch( `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=af&accept-language=${currentLang}&limit=1&viewbox=${viewbox}&bounded=1`, { headers: { 'User-Agent': APP_USER_AGENT } } ); if (!response.ok) { throw new Error(`Nominatim API error: ${response.statusText}`); } const results = await response.json(); if (results && results.length > 0) { const firstResult = results[0]; const { lat, lon } = firstResult; map.setView([parseFloat(lat), parseFloat(lon)], 16); } else { setSearchError(t.searchNoResults); } } catch (error) { console.error("Error during forward geocoding search:", error); setSearchError(t.searchApiError); } finally { setIsSearching(false); }
  }, [searchQuery, currentLang, t.searchNoResults, t.searchApiError, showServiceSheet, showDriverSearchSheet, showTripInProgressSheet]);

  useEffect(() => { if (mapContainerRef.current && !mapInstanceRef.current) { const initialView: L.LatLngExpression = [34.5553, 69.2075]; const newMap = L.map(mapContainerRef.current, { center: initialView, zoom: 13, zoomControl: false, attributionControl: false, }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(newMap); mapInstanceRef.current = newMap; setSearchQuery(t.addressLoading); } return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; }; }, [t.addressLoading]);
  useEffect(() => { const currentDebouncedUpdate = debounce((map: L.Map) => { return updateAddressFromMapCenter(map); }, 750); debouncedUpdateAddressRef.current = currentDebouncedUpdate; const map = mapInstanceRef.current; if (!map) return; if (!showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) { currentDebouncedUpdate(map).catch(err => console.error("Initial debounced call failed:", err)); } const handleMoveEnd = () => { if (!showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) { currentDebouncedUpdate(map).catch(err => console.error("Debounced move_end call failed:", err)); } }; map.on('moveend', handleMoveEnd); return () => { map.off('moveend', handleMoveEnd); }; }, [updateAddressFromMapCenter, showServiceSheet, showDriverSearchSheet, showTripInProgressSheet]);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) { setIsServiceDropdownOpen(false); } }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
  
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showTripInProgressSheet && confirmedOrigin && confirmedDestination) {
        if (!originMapMarker) {
            const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon style={{filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))'}} />);
            const originIcon = L.divIcon({ html: originIconHTML, className: '', iconSize: [40, 40], iconAnchor: [20, 40] });
            const newOriginMarker = L.marker([confirmedOrigin.lat, confirmedOrigin.lng], { icon: originIcon }).addTo(map);
            setOriginMapMarker(newOriginMarker);
        }
        if (!destinationMapMarker) {
            const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon style={{filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))'}} />);
            const destinationIcon = L.divIcon({ html: destIconHTML, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
            const newDestMarker = L.marker([confirmedDestination.lat, confirmedDestination.lng], { icon: destinationIcon }).addTo(map);
            setDestinationMapMarker(newDestMarker);
        }
        if (!driverMarker) {
            const initialDriverLat = confirmedOrigin.lat + (Math.random() > 0.5 ? 0.008 : -0.008); 
            const initialDriverLng = confirmedOrigin.lng + (Math.random() > 0.5 ? 0.008 : -0.008);
            const initialPos = L.latLng(initialDriverLat, initialDriverLng);
            setDriverLocation(initialPos); 

            const carIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />);
            const carIcon = L.divIcon({ html: carIconHTML, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
            const newDriverMarker = L.marker(initialPos, { icon: carIcon, zIndexOffset: 1000 }).addTo(map);
            setDriverMarker(newDriverMarker);
            setTripPhase('enRouteToOrigin'); 
            setTripSheetDisplayLevel('peek'); // Start with peek view
        }
    } else { // Cleanup when showTripInProgressSheet is false
        if (originMapMarker) { map.removeLayer(originMapMarker); setOriginMapMarker(null); }
        if (destinationMapMarker) { map.removeLayer(destinationMapMarker); setDestinationMapMarker(null); }
        if (driverMarker) { map.removeLayer(driverMarker); setDriverMarker(null); }
        setDriverLocation(null); setTripPhase(null); setEstimatedTimeToDestination(null);
        if (simToOriginIntervalIdRef.current) clearInterval(simToOriginIntervalIdRef.current);
        simToOriginIntervalIdRef.current = null;
        if (simToDestinationIntervalIdRef.current) clearInterval(simToDestinationIntervalIdRef.current);
        simToDestinationIntervalIdRef.current = null;
    }
    return () => { 
        if (map) { 
            if (originMapMarker && map.hasLayer(originMapMarker)) map.removeLayer(originMapMarker);
            if (destinationMapMarker && map.hasLayer(destinationMapMarker)) map.removeLayer(destinationMapMarker);
            if (driverMarker && map.hasLayer(driverMarker)) map.removeLayer(driverMarker);
        }
        setOriginMapMarker(null); setDestinationMapMarker(null); setDriverMarker(null);
        setDriverLocation(null); setTripPhase(null); setEstimatedTimeToDestination(null);
        if (simToOriginIntervalIdRef.current) clearInterval(simToOriginIntervalIdRef.current);
        simToOriginIntervalIdRef.current = null;
        if (simToDestinationIntervalIdRef.current) clearInterval(simToDestinationIntervalIdRef.current);
        simToDestinationIntervalIdRef.current = null;
    };
  }, [showTripInProgressSheet, confirmedOrigin, confirmedDestination, mapInstanceRef]); 

  // Simulation: Driver to Origin
  useEffect(() => {
    if (tripPhase === 'enRouteToOrigin' && confirmedOrigin && driverMarker && !simToOriginIntervalIdRef.current) {
        simToOriginIntervalIdRef.current = window.setInterval(() => {
            setDriverLocation(prevDriverLoc => {
                if (!prevDriverLoc || !confirmedOrigin) return prevDriverLoc;
                const target = L.latLng(confirmedOrigin.lat, confirmedOrigin.lng);
                const newLat = prevDriverLoc.lat + (target.lat - prevDriverLoc.lat) * 0.2;
                const newLng = prevDriverLoc.lng + (target.lng - prevDriverLoc.lng) * 0.2;
                const newPos = L.latLng(newLat, newLng);
                
                if (newPos.distanceTo(target) < 10) { 
                    if (simToOriginIntervalIdRef.current) clearInterval(simToOriginIntervalIdRef.current);
                    simToOriginIntervalIdRef.current = null;
                    setTripPhase('enRouteToDestination');
                    if (confirmedDestination) {
                        const distToDest = L.latLng(confirmedOrigin.lat, confirmedOrigin.lng).distanceTo(L.latLng(confirmedDestination.lat, confirmedDestination.lng));
                        const estimatedMinutes = Math.round(distToDest / 1000 * 1.5 + 5); 
                        setEstimatedTimeToDestination(Math.max(1, estimatedMinutes)); 
                    }
                    return target; 
                }
                return newPos;
            });
        }, 1000); 
    }
    return () => { if (simToOriginIntervalIdRef.current) clearInterval(simToOriginIntervalIdRef.current); };
  }, [tripPhase, confirmedOrigin, driverMarker, confirmedDestination]);

  // Simulation: Driver to Destination
  useEffect(() => {
    if (tripPhase === 'enRouteToDestination' && confirmedDestination && driverMarker && !simToDestinationIntervalIdRef.current) {
        simToDestinationIntervalIdRef.current = window.setInterval(() => {
            setDriverLocation(prevDriverLoc => {
                if (!prevDriverLoc || !confirmedDestination) return prevDriverLoc;
                const target = L.latLng(confirmedDestination.lat, confirmedDestination.lng);
                const newLat = prevDriverLoc.lat + (target.lat - prevDriverLoc.lat) * 0.1; 
                const newLng = prevDriverLoc.lng + (target.lng - prevDriverLoc.lng) * 0.1;
                const newPos = L.latLng(newLat, newLng);

                setEstimatedTimeToDestination(prevEta => (prevEta && prevEta > 1 ? prevEta - 1 : ( prevEta === 1 ? 0 : null) ));

                if (newPos.distanceTo(target) < 20) { 
                    if (simToDestinationIntervalIdRef.current) clearInterval(simToDestinationIntervalIdRef.current);
                    simToDestinationIntervalIdRef.current = null;
                    setTripPhase('arrivedAtDestination');
                    setEstimatedTimeToDestination(0);
                    setTripSheetDisplayLevel('default'); // Show rating in default view
                    return target; 
                }
                return newPos;
            });
        }, 2000); 
    }
    return () => { if (simToDestinationIntervalIdRef.current) clearInterval(simToDestinationIntervalIdRef.current); };
  }, [tripPhase, confirmedDestination, driverMarker]);

  // Update driver marker on map. Map bounds are now manually controlled by user or set once per phase.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (driverMarker && driverLocation && map) {
        driverMarker.setLatLng(driverLocation);
    }
  }, [driverLocation, driverMarker, mapInstanceRef]);

  // Effect to set initial map bounds when a trip phase starts, then detach auto-bounding.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !confirmedOrigin || !confirmedDestination || !driverLocation) return;

    let shouldFitBoundsOnce = false;
    let boundsToShow: L.LatLngExpression[] = [];

    if (tripPhase === 'enRouteToOrigin' && driverLocation.distanceTo(L.latLng(confirmedOrigin.lat, confirmedOrigin.lng)) > 10 && !map.getBounds().contains(driverLocation)) { 
        shouldFitBoundsOnce = true;
        boundsToShow = [ 
            L.latLng(confirmedOrigin.lat, confirmedOrigin.lng), 
            L.latLng(confirmedDestination.lat, confirmedDestination.lng),
            driverLocation 
        ];
    } else if (tripPhase === 'enRouteToDestination' && driverLocation.distanceTo(L.latLng(confirmedDestination.lat, confirmedDestination.lng)) > 20 && !map.getBounds().contains(driverLocation)) {
        shouldFitBoundsOnce = true;
        boundsToShow = [ 
            L.latLng(confirmedDestination.lat, confirmedDestination.lng), 
            driverLocation 
        ];
    }
    
    if (shouldFitBoundsOnce && boundsToShow.length > 0) {
        map.fitBounds(L.latLngBounds(boundsToShow), { padding: [70, 70], maxZoom: 17, animate: true });
    }
  }, [tripPhase, confirmedOrigin, confirmedDestination, driverLocation, mapInstanceRef]); // Removed driverLocation from dependency to avoid frequent refit


  const handleGpsClick = () => { if (navigator.geolocation && mapInstanceRef.current && !showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) { const map = mapInstanceRef.current; navigator.geolocation.getCurrentPosition( (position) => { const userLatLng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude]; map.setView(userLatLng, 15); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(map).catch(err => console.error("Debounced GPS click call failed:", err)); } }, (error: GeolocationPositionError) => { console.error("Error getting GPS location:", error); alert("Unable to retrieve your location. Please ensure location services are enabled."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } ); } };
  const calculateRouteDistance = async (origin: {lat: number, lng: number}, destination: {lat: number, lng: number}) => { setIsCalculatingDistance(true); setDistanceError(null); setRouteDistanceKm(null); try { const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`, { headers: { 'User-Agent': APP_USER_AGENT } }); if (!response.ok) { throw new Error(`OSRM API error: ${response.status} ${response.statusText}`); } const data = await response.json(); if (data.routes && data.routes.length > 0 && data.routes[0].distance) { const distanceInKm = data.routes[0].distance / 1000; setRouteDistanceKm(distanceInKm); } else { throw new Error("No route found or distance missing in OSRM response."); } } catch (error) { console.error("Error calculating route distance:", error); setDistanceError(t.priceCalculationError); } finally { setIsCalculatingDistance(false); } };
  const handleConfirmOriginOrDestination = () => { if (isLoadingAddress || isSearching || !mapInstanceRef.current || !address || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) return; const currentMap = mapInstanceRef.current; const center = currentMap.getCenter(); const currentValidAddress = address; if (selectionMode === 'origin') { setConfirmedOrigin({ lat: center.lat, lng: center.lng, address: currentValidAddress }); setSelectionMode('destination'); setSearchQuery(''); setAddress(''); setSearchError(''); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(currentMap).catch(err => console.error("Update address for dest failed:", err)); } } else { const destDetails = { lat: center.lat, lng: center.lng, address: currentValidAddress }; setConfirmedDestination(destDetails); if(confirmedOrigin) { calculateRouteDistance( {lat: confirmedOrigin.lat, lng: confirmedOrigin.lng}, {lat: destDetails.lat, lng: destDetails.lng} ).finally(() => { setShowServiceSheet(true); }); } else { setDistanceError("Origin not confirmed."); setShowServiceSheet(true); } } };
  
  const startDriverSearchSimulation = () => {
    setDriverSearchState('searching'); setNotifiedDriverCount(0);
    if(searchIntervalIdRef.current) clearInterval(searchIntervalIdRef.current);
    setTimeout(() => {
      setDriverSearchState('driverAssigned');
      setShowDriverSearchSheet(false); 
      setShowTripInProgressSheet(true); 
      setTripSheetDisplayLevel('peek'); // Start in peek mode
    }, 2000); 
  };

  const resetToInitialMapState = () => { 
    setShowDriverSearchSheet(false); 
    setShowTripInProgressSheet(false); 
    
    if (simToOriginIntervalIdRef.current) clearInterval(simToOriginIntervalIdRef.current);
    simToOriginIntervalIdRef.current = null;
    if (simToDestinationIntervalIdRef.current) clearInterval(simToDestinationIntervalIdRef.current);
    simToDestinationIntervalIdRef.current = null;
    
    setDriverSearchState('idle'); 
    setNotifiedDriverCount(0); 
    if(searchIntervalIdRef.current) clearInterval(searchIntervalIdRef.current); 
    searchIntervalIdRef.current = null; 
    setSelectionMode('origin'); 
    setConfirmedOrigin(null); 
    setConfirmedDestination(null); 
    setSearchQuery(''); setAddress(''); setRouteDistanceKm(null); 
    setIsCalculatingDistance(false); setDistanceError(null); 
    setSelectedServiceForSearch(null); setCurrentTripFare(null); 
    setTripSheetDisplayLevel('peek'); 
    setTripPhase(null); 
    setDriverLocation(null); 
    setEstimatedTimeToDestination(null);
    
    const map = mapInstanceRef.current;
    if (map) {
        if (originMapMarker && map.hasLayer(originMapMarker)) { map.removeLayer(originMapMarker); setOriginMapMarker(null); }
        if (destinationMapMarker && map.hasLayer(destinationMapMarker)) { map.removeLayer(destinationMapMarker); setDestinationMapMarker(null); }
        if (driverMarker && map.hasLayer(driverMarker)) { map.removeLayer(driverMarker); setDriverMarker(null); }
    }
    
    if (mapInstanceRef.current && debouncedUpdateAddressRef.current) { 
        debouncedUpdateAddressRef.current(mapInstanceRef.current)
            .catch(err => console.error("Update address for new origin failed:", err)); 
    } 
  };

  const handleRequestRideFromSheet = (service: Service, estimatedPrice: number | null) => {
    setShowServiceSheet(false);
    setSelectedServiceForSearch(service);
    setCurrentTripFare(estimatedPrice);
    setShowDriverSearchSheet(true);
    startDriverSearchSimulation();
  };

  const handleRetryDriverSearch = () => { startDriverSearchSimulation(); };
  const handleCancelDriverSearch = () => { resetToInitialMapState(); };
  const handleGoBackToOriginSelection = () => { setSelectionMode('origin'); setSearchError(''); setShowServiceSheet(false); setRouteDistanceKm(null); setIsCalculatingDistance(false); setDistanceError(null); if (confirmedOrigin) { setAddress(confirmedOrigin.address); setSearchQuery(confirmedOrigin.address); if (mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedOrigin.lat, confirmedOrigin.lng]); } } else if (mapInstanceRef.current && debouncedUpdateAddressRef.current) { setAddress(''); setSearchQuery(''); debouncedUpdateAddressRef.current(mapInstanceRef.current).catch(err => console.error("Update address on back failed:", err)); } };
  const handleCloseServiceSheet = () => { setShowServiceSheet(false); if (confirmedDestination && mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedDestination.lat, confirmedDestination.lng]); setAddress(confirmedDestination.address); setSearchQuery(confirmedDestination.address); setSelectionMode('destination'); setIsLoadingAddress(false); setSearchError(''); } };
  const toggleServiceDropdown = () => setIsServiceDropdownOpen(!isServiceDropdownOpen);
  const selectServiceType = (type: 'self' | 'other') => { setServiceFor(type); setIsServiceDropdownOpen(false); };

  const mapScreenContainerStyle: CSSProperties = { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#e0e0e0' };
  const leafletMapContainerStyle: CSSProperties = { width: '100%', height: '100%' };
  const fixedMarkerStyle: CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', display: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || !mapInstanceRef.current) ? 'none' : 'block' };
  const topControlsContainerStyle: CSSProperties = { position: 'absolute', top: '1rem', left: '1rem', right: '1rem', height: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1010, pointerEvents: 'none', };
  const topBarButtonStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '50%', width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', border: 'none', padding: 0, };
  const serviceTypePillContainerStyle: CSSProperties = { flexGrow: 1, display: 'flex', justifyContent: 'center', pointerEvents: 'none', visibility: (showDriverSearchSheet || showTripInProgressSheet) ? 'hidden' : 'visible', };
  const serviceTypePillStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '2rem', padding: '0.5rem 1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#333', fontWeight: 500, pointerEvents: 'auto', margin: '0 auto', };
  const serviceDropdownStyle: CSSProperties = { position: 'absolute', top: 'calc(100% + 0.5rem)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 1011, minWidth: '150px', border: '1px solid #eee' };
  const serviceDropdownItemStyle: CSSProperties = { padding: '0.75rem 1rem', cursor: 'pointer', fontSize: '0.875rem', textAlign: isRTL ? 'right' : 'left' }; const serviceDropdownItemHoverStyle: CSSProperties = { backgroundColor: '#f0f0f0' };
  
  const getGpsButtonBottom = () => {
    if (showServiceSheet) return 'calc(70vh + 1rem)';
    if (showDriverSearchSheet) return 'calc(250px + 1rem)'; 
    if (showTripInProgressSheet) {
        if (tripSheetDisplayLevel === 'peek') return 'calc(180px + 1rem)';
        if (tripSheetDisplayLevel === 'default') return 'calc(320px + 1rem)';
        return 'calc(85vh + 1rem)'; // For 'full'
    }
    return '13rem';
  };
  const gpsButtonVisibilityLogic = (showServiceSheet || showDriverSearchSheet || (showTripInProgressSheet && tripSheetDisplayLevel === 'full')) ? 'hidden' : 'visible';

  const gpsButtonStyle: CSSProperties = { 
    position: 'absolute', 
    bottom: getGpsButtonBottom(), 
    [isRTL ? 'right' : 'left']: '1rem', 
    backgroundColor: 'white', 
    borderRadius: '50%', 
    width: '3.25rem', height: '3.25rem', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)', 
    cursor: 'pointer', zIndex: 1000, border: 'none', 
    transition: 'bottom 0.3s ease-out, visibility 0.3s ease-out',
    visibility: gpsButtonVisibilityLogic,
  };

  const bottomPanelStyle: CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: '1rem 1.5rem 1.5rem', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', transform: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) ? 'translateY(100%)' : 'translateY(0)', visibility: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) ? 'hidden' : 'visible', transition: 'transform 0.3s ease-out, visibility 0.3s ease-out' };
  const addressInputContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: '0.5rem', padding: isRTL ? '0.75rem 1rem 0.75rem 0.5rem' : '0.75rem 0.5rem 0.75rem 1rem', marginBottom: '0.5rem' };
  const addressPointStyle: CSSProperties = { width: '10px', height: '10px', backgroundColor: selectionMode === 'origin' ? '#007bff' : '#28a745', borderRadius: selectionMode === 'origin' ? '50%' : '2px', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', flexShrink: 0 };
  const addressInputStyle: CSSProperties = { flexGrow: 1, fontSize: '0.9rem', color: '#333', textAlign: isRTL ? 'right' : 'left', backgroundColor: 'transparent', border: 'none', outline: 'none', padding: '0 0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', };
  const searchButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0, [isRTL ? 'marginRight' : 'marginLeft'] : '0.5rem' }; const searchButtonDisabledStyle: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
  const searchErrorStyle: CSSProperties = { fontSize: '0.75rem', color: 'red', textAlign: 'center', minHeight: '1.2em', marginBottom: '0.5rem' };
  const confirmMainButtonStyle: CSSProperties = { width: '100%', backgroundColor: selectionMode === 'destination' ? '#28a745' : '#007bff', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' };
  if (selectionMode === 'destination') { confirmMainButtonStyle.backgroundColor = '#28a745'; }
  const confirmMainButtonHoverStyle: CSSProperties = { backgroundColor: selectionMode === 'destination' ? '#218838' : '#0056b3' };
  if (selectionMode === 'destination') { confirmMainButtonHoverStyle.backgroundColor = '#218838'; }
  const confirmMainButtonDisabledStyle: CSSProperties = { backgroundColor: '#a5d6a7', cursor: 'not-allowed' };
  const [isConfirmMainButtonHovered, setIsConfirmMainButtonHovered] = useState(false);
  let currentConfirmMainButtonStyle = confirmMainButtonStyle;
  if (isLoadingAddress || isSearching || !address) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonDisabledStyle}; } else if (isConfirmMainButtonHovered) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonHoverStyle}; }
  
  const handleToggleTripSheetDisplay = () => {
    setTripSheetDisplayLevel(prevLevel => {
        if (prevLevel === 'peek') return 'default';
        if (prevLevel === 'default') return 'full';
        if (prevLevel === 'full') return 'peek';
        return 'default'; // Fallback
    });
  };

  return (
    <div style={mapScreenContainerStyle}>
      <div ref={mapContainerRef} style={leafletMapContainerStyle} />
      <div ref={fixedMarkerRef} style={fixedMarkerStyle} aria-live="polite" aria-atomic="true"> {selectionMode === 'origin' ? <LocationMarkerIcon ariaLabel={t.originMarkerAriaLabel} /> : <DestinationMarkerIcon ariaLabel={t.destinationMarkerAriaLabel} />} </div>
      <div style={topControlsContainerStyle}>
        <div style={{ pointerEvents: 'auto' }}>
          { (showDriverSearchSheet || showTripInProgressSheet) ? ( <button style={topBarButtonStyle} onClick={handleCancelDriverSearch} aria-label={t.closeDriverSearchSheetAriaLabel}> <CloseIcon /> </button> ) : showServiceSheet ? ( <button style={topBarButtonStyle} onClick={handleCloseServiceSheet} aria-label={t.closeSheetButtonAriaLabel}> <BackArrowIcon style={{transform: isRTL ? 'scaleX(-1)' : 'none'}}/> </button> ) : selectionMode === 'destination' ? ( <button style={topBarButtonStyle} onClick={handleGoBackToOriginSelection} aria-label={t.backButtonAriaLabel}> <BackArrowIcon style={{transform: isRTL ? 'scaleX(-1)' : 'none'}}/> </button> ) : ( <button style={topBarButtonStyle} aria-label={t.homeButtonAriaLabel}><HomeIcon /></button> )}
        </div>
        <div style={serviceTypePillContainerStyle}> {!(showDriverSearchSheet || showTripInProgressSheet) && ( <div ref={serviceDropdownRef} style={{ position: 'relative', pointerEvents: 'auto' }}> <div style={serviceTypePillStyle} onClick={toggleServiceDropdown}> {serviceFor === 'self' ? t.serviceForSelf : t.serviceForOther} <ChevronDownIcon style={{ [isRTL ? 'marginRight' : 'marginLeft']: '0.5rem', transform: isServiceDropdownOpen ? 'rotate(180deg)' : '' }} /> </div> {isServiceDropdownOpen && ( <div style={serviceDropdownStyle}> <div style={serviceDropdownItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemStyle.backgroundColor!} onClick={() => selectServiceType('self')}>{t.serviceForSelf}</div> <div style={serviceDropdownItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemStyle.backgroundColor!} onClick={() => selectServiceType('other')}>{t.serviceForOther}</div> </div> )} </div> )} </div>
        <div style={{ pointerEvents: 'auto' }}> 
            <button style={topBarButtonStyle} aria-label={t.profileButtonAriaLabel}><ProfileIcon /></button> 
        </div>
      </div>
      <button style={gpsButtonStyle} onClick={handleGpsClick} aria-label={t.gpsButtonAriaLabel}><GpsIcon /></button>
      <div style={bottomPanelStyle}>
        <div style={addressInputContainerStyle}> <div style={addressPointStyle} /> <input type="text" style={addressInputStyle} value={isLoadingAddress ? t.addressLoading : (isSearching ? t.searchingAddress : searchQuery)} onChange={(e) => { setSearchQuery(e.target.value); if (searchError) setSearchError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} placeholder={selectionMode === 'origin' ? t.searchPlaceholderOrigin : t.searchPlaceholderDestination} readOnly={isLoadingAddress || isSearching} aria-label={t.searchAddressLabel} dir={isRTL ? 'rtl': 'ltr'} /> <button onClick={handleSearch} style={ (isSearching || isLoadingAddress || !searchQuery.trim()) ? {...searchButtonStyle, ...searchButtonDisabledStyle} : searchButtonStyle } disabled={isSearching || isLoadingAddress || !searchQuery.trim()} aria-label={t.searchIconAriaLabel} > <SearchIcon /> </button> </div>
        {searchError ? <p style={searchErrorStyle} role="alert">{searchError}</p> : <div style={{...searchErrorStyle, visibility: 'hidden'}}>Placeholder</div> }
        <button style={currentConfirmMainButtonStyle} onMouseEnter={() => setIsConfirmMainButtonHovered(true)} onMouseLeave={() => setIsConfirmMainButtonHovered(false)} onClick={handleConfirmOriginOrDestination} disabled={isLoadingAddress || isSearching || !address} > {selectionMode === 'origin' ? t.confirmOriginButton : t.confirmDestinationButton} </button>
      </div>
      {showServiceSheet && confirmedOrigin && confirmedDestination && ( <ServiceSelectionSheet currentLang={currentLang} originAddress={confirmedOrigin.address} destinationAddress={confirmedDestination.address} routeDistanceKm={routeDistanceKm} isCalculatingDistance={isCalculatingDistance} distanceError={distanceError} onRequestRide={handleRequestRideFromSheet} /> )}
      {showDriverSearchSheet && selectedServiceForSearch && ( <DriverSearchSheet currentLang={currentLang} searchState={driverSearchState} notifiedDriverCount={notifiedDriverCount} onRetry={handleRetryDriverSearch} onCancel={handleCancelDriverSearch} onClose={handleCancelDriverSearch} /> )}
      {showTripInProgressSheet && ( <TripInProgressSheet currentLang={currentLang} driverDetails={mockDriverData} tripFare={currentTripFare}
        tripPhase={tripPhase} estimatedTimeToDestination={estimatedTimeToDestination}
        displayLevel={tripSheetDisplayLevel} onToggleDisplayLevel={handleToggleTripSheetDisplay}
        onCallDriver={() => console.log("Call driver clicked")} onMessageDriver={() => console.log("Message driver clicked")}
        onPayment={() => console.log("Payment clicked")} 
        onChangeDestination={() => console.log("Change destination clicked (Not implemented)")}
        onApplyCoupon={() => console.log("Apply coupon clicked (Not implemented)")} 
        onRideOptions={() => console.log("Ride options clicked (Not implemented)")}
        onCancelTrip={() => { console.log("Cancel trip clicked"); resetToInitialMapState();}} 
        onSafety={() => console.log("Safety clicked (Not implemented)")}
        onClose={resetToInitialMapState} />
      )}
    </div>
  );
};
const App = () => {
  const [currentScreen, setCurrentScreen] = useState<'phoneInput' | 'otpVerification' | 'mapScreen'>('phoneInput');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => { const browserLang = navigator.language.split('-')[0]; if (browserLang === 'ps') return 'ps'; if (browserLang === 'en') return 'en'; return 'fa'; });
  useEffect(() => { document.documentElement.lang = currentLanguage; document.documentElement.dir = currentLanguage === 'en' ? 'ltr' : 'rtl'; const styleElement = document.getElementById('global-app-styles'); if (styleElement) { let fontFamily = 'Tahoma, Arial, sans-serif'; if (currentLanguage === 'en') fontFamily = '"Helvetica Neue", Helvetica, Arial, sans-serif'; if (currentScreen === 'mapScreen') { styleElement.innerHTML = ` body { font-family: ${fontFamily}; margin: 0; padding: 0; height: 100vh; width: 100vw; overflow: hidden; direction: ${currentLanguage === 'en' ? 'ltr' : 'rtl'}; line-height: 1.5; color: #1f2937; overscroll-behavior: none; } #root { width: 100%; height: 100%; } * { box-sizing: border-box; } .leaflet-control-container { display: none !important; } `; } else { styleElement.innerHTML = ` body { font-family: ${fontFamily}; background-color: #f3f4f6; margin: 0; padding: 1rem; display: flex; justify-content: center; align-items: center; min-height: 100vh; direction: ${currentLanguage === 'en' ? 'ltr' : 'rtl'}; line-height: 1.5; color: #1f2937; } #root { width: 100%; display: flex; justify-content: center; align-items: flex-start; } * { box-sizing: border-box; } input[type="tel"]::-webkit-outer-spin-button, input[type="tel"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; } input[type="tel"] { -moz-appearance: textfield; } .terms-link { color: #059669; font-weight: 500; text-decoration: none; } .terms-link:hover { text-decoration: underline; color: #047857; } `; } } }, [currentLanguage, currentScreen]);
  const handlePhoneSubmitted = (phoneNumber: string) => { setUserPhoneNumber(phoneNumber); setCurrentScreen('otpVerification'); console.log(`OTP requested for ${phoneNumber} (Simulated)`); };
  const handleOtpConfirmed = (otpCode: string) => { console.log(`کد ${otpCode} برای شماره ${userPhoneNumber} با موفقیت تایید شد!`); setCurrentScreen('mapScreen'); };
  const handleResendOtp = () => { alert(`کد جدید برای شماره ${userPhoneNumber} ارسال شد. (پیام نمایشی)`); };
  const handleBackToPhoneInput = () => { setCurrentScreen('phoneInput'); setUserPhoneNumber(''); };
  if (currentScreen === 'phoneInput') { return <PhoneInputScreen currentLang={currentLanguage} onLangChange={setCurrentLanguage} onNext={handlePhoneSubmitted} />; } else if (currentScreen === 'otpVerification') { return <OtpScreen currentLang={currentLanguage} phoneNumber={userPhoneNumber} onConfirm={handleOtpConfirmed} onResendOtp={handleResendOtp} onBack={handleBackToPhoneInput} />; } else if (currentScreen === 'mapScreen') { return <MapScreen currentLang={currentLanguage} />; } return null;
};

export default App;