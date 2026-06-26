import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Trash2, 
  Plus,
  Building, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  ShieldAlert, 
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  Info,
  Sun,
  Moon
} from 'lucide-react';

import { HUNAN_REGIONS } from './data/hunanRegions';
import { HAZARDS_DEFINITIONS, HazardDefinition } from './data/questions';
import { SurveyState, UploadedPhoto, SurveySubmission } from './types';
import ReportingHistory from './components/ReportingHistory';

// 后端 API 地址配置 - 本地 Express 服务器
const API_BASE = '';

/**
 * 带超时的 fetch 封装，防止请求"卡死"半天没反应
 * @param url 请求 URL
 * @param options fetch 选项
 * @param timeout 超时时间（毫秒），默认 15 秒
 */
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default function App() {
  const getHazardsList = (): { checked: boolean; photos: UploadedPhoto[] }[] => {
    return Object.values(state.hazards) as { checked: boolean; photos: UploadedPhoto[] }[];
  };

  const [currentStep, setCurrentStep] = useState<number>(0);
  
  const [state, setState] = useState<SurveyState>({
    reporterName: '',
    reporterTitle: '',
    reporterPhone: '',
    selectedCity: '',
    selectedCounty: '',
    cinemaName: '',
    hazards: {
      5: { checked: false, photos: [] },
      6: { checked: false, photos: [] },
      7: { checked: false, photos: [] },
      8: { checked: false, photos: [] },
      9: { checked: false, photos: [] },
      10: { checked: false, photos: [] },
      16: { checked: false, photos: [] },
      12: { checked: false, photos: [] },
      13: { checked: false, photos: [] },
      11: { checked: false, photos: [] },
      14: { checked: false, photos: [] },
      15: { checked: false, photos: [] },
    },
    othersText: '',
    othersPhotos: []
  });

  const [phoneError, setPhoneError] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [cityError, setCityError] = useState<string>('');
  const [cinemaError, setCinemaError] = useState<string>('');
  const [formAttempted, setFormAttempted] = useState<boolean>(false);
  
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsSuccess, setGpsSuccess] = useState<string>('');
  const [gpsDebug, setGpsDebug] = useState<string>('');
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [locationPickerOpen, setLocationPickerOpen] = useState<boolean>(false);
  const [pickerCity, setPickerCity] = useState<string>('');
  const [pickerCounty, setPickerCounty] = useState<string>('');

  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('hunan_cinema_survey_dark_mode');
    return saved === 'true';
  });

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('hunan_cinema_survey_dark_mode', String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Load persisted submissions from localStorage
  useEffect(() => {
    const cached = localStorage.getItem('hunan_cinema_survey_submissions');
    if (cached) {
      try {
        setSubmissions(JSON.parse(cached));
      } catch (e) {
        console.error('Error parsing stored submissions:', e);
      }
    }
  }, []);

  const saveSubmissions = (newSubmissions: SurveySubmission[]) => {
    setSubmissions(newSubmissions);
    localStorage.setItem('hunan_cinema_survey_submissions', JSON.stringify(newSubmissions));
  };

  // Load persisted form draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem('hunan_cinema_survey_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        // Merge old draft with current hazard definitions to ensure any newly added
        // hazard IDs (e.g. 14, 15, 16) are present with default values
        const defaultHazards: Record<number, { checked: boolean; photos: UploadedPhoto[] }> = {};
        HAZARDS_DEFINITIONS.forEach(def => {
          defaultHazards[def.id] = { checked: false, photos: [] };
        });
        const mergedHazards = { ...defaultHazards, ...(parsed.hazards || {}) };
        setState({ ...parsed, hazards: mergedHazards });
      } catch (e) {
        console.error('Error parsing stored draft:', e);
      }
    }
  }, []);

  // Auto-save form draft to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('hunan_cinema_survey_draft', JSON.stringify(state));
  }, [state]);

  const clearDraft = () => {
    localStorage.removeItem('hunan_cinema_survey_draft');
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/[^\d]/g, '').slice(0, 11);
    setState(prev => ({ ...prev, reporterPhone: cleaned }));
    if (formAttempted) {
      if (cleaned.length !== 11) {
        setPhoneError('联系方式应为11位数字手机号码');
      } else {
        setPhoneError('');
      }
    }
  };

  /** Normalize a Chinese location string by removing common administrative suffixes */
  const normalizeLocation = (str: string): string => {
    return str
      .replace(/[市|区|县|州|省|镇|乡|村|路|道|街|巷|弄|栋|座|楼|室|号|坪|坝|坡|岭|山|水|河|湖|海|岛|港|湾|城|都|自治州|自治县|苗族|土家族|侗族|瑶族]/g, '')
      .trim();
  };

  /**
   * Find the Hunan region that best matches the given location strings.
   * Tries multiple strategies: exact city match, county match, partial match, prefix match.
   */
  const findBestRegion = (
    cityName: string,
    countyName: string
  ): { region: typeof HUNAN_REGIONS[0]; matchedCounty: string } | null => {
    const normalizedCity = normalizeLocation(cityName);
    const normalizedCounty = normalizeLocation(countyName);

    // Helper: check if a normalized name matches a region name
    const matchesRegion = (normalized: string, region: typeof HUNAN_REGIONS[0]): boolean => {
      const nr = normalizeLocation(region.name);
      return normalized === nr || normalized.includes(nr) || nr.includes(normalized);
    };

    // Helper: find a matching county within a region, returns the full county name
    const findCounty = (normalized: string, region: typeof HUNAN_REGIONS[0]): string => {
      if (!normalized) return '';
      for (const county of region.counties) {
        const nc = normalizeLocation(county);
        if (normalized === nc || normalized.includes(nc) || nc.includes(normalized)) {
          return county;
        }
      }
      return '';
    };

    // Strategy 1: Try to match by city name first
    if (normalizedCity) {
      for (const region of HUNAN_REGIONS) {
        if (matchesRegion(normalizedCity, region)) {
          const matchedCounty = findCounty(normalizedCounty, region);
          return { region, matchedCounty };
        }
      }
    }

    // Strategy 2: Try to match by county name across ALL regions
    // This handles cases where the city name is wrong but county is correct
    if (normalizedCounty) {
      for (const region of HUNAN_REGIONS) {
        const matchedCounty = findCounty(normalizedCounty, region);
        if (matchedCounty) {
          return { region, matchedCounty };
        }
      }
    }

    // Strategy 3: Try partial matching - check if city name contains any region name
    if (normalizedCity) {
      for (const region of HUNAN_REGIONS) {
        const nr = normalizeLocation(region.name);
        // Check if any part of the city string matches a region
        for (const part of normalizedCity.split(/[\s,，、]/)) {
          if (part && (nr.includes(part) || part.includes(nr))) {
            const matchedCounty = findCounty(normalizedCounty, region);
            return { region, matchedCounty };
          }
        }
      }
    }

    // Strategy 4: Try prefix matching - e.g. "长沙" should match "长沙市"
    if (normalizedCity) {
      for (const region of HUNAN_REGIONS) {
        const nr = normalizeLocation(region.name);
        // Check if normalizedCity starts with the region name or vice versa
        if (normalizedCity.startsWith(nr) || nr.startsWith(normalizedCity)) {
          const matchedCounty = findCounty(normalizedCounty, region);
          return { region, matchedCounty };
        }
      }
    }

    // Strategy 5: Try matching county name against city names
    // Some Nominatim responses put city name in county field
    if (normalizedCounty) {
      for (const region of HUNAN_REGIONS) {
        const nr = normalizeLocation(region.name);
        if (normalizedCounty === nr || normalizedCounty.includes(nr) || nr.includes(normalizedCounty)) {
          return { region, matchedCounty: '' };
        }
      }
    }

    // Strategy 6: Try matching province-level city names (e.g. "湖南" → try to find any Hunan region)
    // This handles cases where only province info is available
    if (normalizedCity && normalizedCity.includes('湖南')) {
      // If we know it's in Hunan but can't determine the city, return null to let user pick manually
      return null;
    }

    // Strategy 7: Try matching by checking if the city name contains any known Hunan city prefix
    // e.g. "长沙市开福区" should match "长沙市"
    if (normalizedCity) {
      for (const region of HUNAN_REGIONS) {
        const nr = normalizeLocation(region.name);
        // Check if the city string contains the region name as a substring
        if (normalizedCity.includes(nr)) {
          const matchedCounty = findCounty(normalizedCounty, region);
          return { region, matchedCounty };
        }
      }
    }

    // Strategy 8: Try matching by checking if any region name is contained in the city string
    // e.g. "芙蓉区" (a district of Changsha) - try to find which region contains this county
    if (normalizedCounty) {
      for (const region of HUNAN_REGIONS) {
        const matchedCounty = findCounty(normalizedCounty, region);
        if (matchedCounty) {
          return { region, matchedCounty };
        }
      }
    }

    // Strategy 9: Try matching by checking if county name contains any region name
    // Some APIs return county-level info that includes the city name
    if (normalizedCounty) {
      for (const region of HUNAN_REGIONS) {
        const nr = normalizeLocation(region.name);
        for (const county of region.counties) {
          const nc = normalizeLocation(county);
          if (normalizedCounty.includes(nc) || nc.includes(normalizedCounty)) {
            return { region, matchedCounty: county };
          }
        }
      }
    }

    return null;
  };

  /** Pure JS MD5 implementation for generating 高德 jscode signature */
  const md5 = (str: string): string => {
    const rotateLeft = (x: number, n: number) => (x << n) | (x >>> (32 - n));
    const toHex = (num: number): string => {
      let hex = '';
      for (let i = 0; i < 4; i++) {
        hex += ('0' + ((num >>> (i * 8)) & 0xFF).toString(16)).slice(-2);
      }
      return hex;
    };

    const utf8Encode = (s: string): string => {
      return unescape(encodeURIComponent(s));
    };

    const s = utf8Encode(str);
    const n = s.length;
    const state = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
    const block = [];
    let i = 0;

    for (i = 0; i < n; i++) {
      block[i >> 2] = (block[i >> 2] || 0) + (s.charCodeAt(i) << ((i % 4) * 8));
    }

    block[i >> 2] = (block[i >> 2] || 0) + (0x80 << ((i % 4) * 8));
    block[(((i + 8) >> 6) << 4) + 14] = n * 8;

    const S = [
      [7, 12, 17, 22],
      [5, 9, 14, 20],
      [4, 11, 16, 23],
      [6, 10, 15, 21]
    ];
    const T = new Array(64);
    for (i = 0; i < 64; i++) {
      T[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
    }

    for (let offset = 0; offset < block.length; offset += 16) {
      const X = block.slice(offset, offset + 16);
      let [A, B, C, D] = state;

      for (let j = 0; j < 64; j++) {
        let F, g;
        if (j < 16) {
          F = (B & C) | (~B & D);
          g = j;
        } else if (j < 32) {
          F = (D & B) | (~D & C);
          g = (5 * j + 1) % 16;
        } else if (j < 48) {
          F = B ^ C ^ D;
          g = (3 * j + 5) % 16;
        } else {
          F = C ^ (B | ~D);
          g = (7 * j) % 16;
        }
        const temp = D;
        D = C;
        C = B;
        B = B + rotateLeft((A + F + T[j] + (X[g] || 0)) & 0xFFFFFFFF, S[Math.floor(j / 16)][j % 4]);
        A = temp;
      }

      state[0] = (state[0] + A) & 0xFFFFFFFF;
      state[1] = (state[1] + B) & 0xFFFFFFFF;
      state[2] = (state[2] + C) & 0xFFFFFFFF;
      state[3] = (state[3] + D) & 0xFFFFFFFF;
    }

    return state.map(toHex).join('');
  };

  /** Generate 高德安全密钥 jscode signature */
  const generateAmapJscode = (secret: string, params: string): string => {
    // jscode = MD5(secret + params_sorted_by_key)
    // params format: key1=value1&key2=value2...
    const sorted = params.split('&').sort().join('&');
    const str = secret + sorted;
    return md5(str);
  };

  /** Try to reverse geocode GPS coordinates - uses free, unlimited services that work on both mobile and PC */
  const reverseGeocode = async (latitude: number, longitude: number): Promise<{ city: string; county: string } | null> => {
    // Strategy 1: BigDataCloud (free, unlimited, no key, works in browser, supports Chinese, works on mobile)
    // This is the preferred strategy because it's free, unlimited, and works on both mobile and PC
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let city = data.city || '';
      let county = data.locality || '';
      
      // Try to extract county/district from administrative hierarchy
      if (!county || county === city) {
        const admin = data.localityInfo?.administrative || [];
        // adminLevel 6 = district/county in China
        const dist = admin.find((a: any) => a.adminLevel === 6);
        if (dist?.name) county = dist.name;
        // adminLevel 7 = subdistrict/town
        if (!county) {
          const sub = admin.find((a: any) => a.adminLevel === 7);
          if (sub?.name) county = sub.name;
        }
        // adminLevel 5 = prefecture city (fallback)
        if (!county) {
          const pref = admin.find((a: any) => a.adminLevel === 5);
          if (pref?.name) county = pref.name;
        }
      }
      
      console.log('BigDataCloud geocode success:', { city, county });
      if (city || county) {
        return { city: city || '', county: county || '' };
      }
    } catch (err) {
      console.warn('BigDataCloud failed:', err);
    }

    // Strategy 2: Nominatim (free, unlimited, works in browser, good for mobile)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=zh&zoom=10`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const addr = data.address || {};
      let city = addr.city || addr.town || addr.county || addr.state_district || '';
      let county = addr.district || addr.suburb || addr.county || '';
      if (county === city) county = '';
      console.log('Nominatim geocode success:', { city, county });
      if (city || county) {
        return { city: city || '', county: county || '' };
      }
    } catch (err) {
      console.warn('Nominatim failed:', err);
    }

    // Strategy 3: Try Worker proxy (calls 高德 API server-side, most accurate in China but requires Worker to be deployed)
    try {
      const workerUrl = API_BASE ? `${API_BASE}/api/geocode?lat=${latitude}&lng=${longitude}` : `/api/geocode?lat=${latitude}&lng=${longitude}`;
      const res = await fetch(workerUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const { city, district } = data.data;
          console.log('Worker/高德 geocode success:', { city, district });
          return { city: city || '', county: district || '' };
        }
      }
    } catch (err) {
      console.warn('Worker geocode failed:', err);
    }

    return null;
  };

  /** Attempt browser GPS-based geolocation with reverse geocoding */
  const locateByGPS = (): Promise<{ city: string; county: string; raw?: string } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('GPS: navigator.geolocation not available');
        resolve(null);
        return;
      }

      let watchId: number | null = null;
      let resolved = false;
      let retryCount = 0;
      const MAX_RETRIES = 1;

      const doGetPosition = () => {
        if (resolved) return;

        // First try: getCurrentPosition (simpler, faster, works on most devices)
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (resolved) return;
            resolved = true;
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);

            const { latitude, longitude } = position.coords;
            console.log('GPS: got coordinates', { latitude, longitude });
            
            const result = await reverseGeocode(latitude, longitude);
            if (result) {
              resolve({ ...result, raw: undefined });
            } else {
              resolve(null);
            }
          },
          (error) => {
            console.warn('GPS getCurrentPosition error:', error.code, error.message);
            
            // If permission denied, don't retry - just fail fast
            if (error.code === error.PERMISSION_DENIED) {
              if (!resolved) {
                resolved = true;
                resolve(null);
              }
              return;
            }
            
            // Retry with watchPosition (keeps GPS hardware active)
            if (retryCount < MAX_RETRIES && !resolved) {
              retryCount++;
              console.log(`GPS retry ${retryCount}/${MAX_RETRIES} with watchPosition...`);
              
              const id = navigator.geolocation.watchPosition(
                async (position) => {
                  if (resolved) {
                    navigator.geolocation.clearWatch(id);
                    return;
                  }
                  resolved = true;
                  if (watchId !== null) navigator.geolocation.clearWatch(watchId);

                  const { latitude, longitude } = position.coords;
                  console.log('GPS watchPosition: got coordinates', { latitude, longitude });
                  
                  const result = await reverseGeocode(latitude, longitude);
                  if (result) {
                    resolve({ ...result, raw: undefined });
                  } else {
                    resolve(null);
                  }
                },
                (watchError) => {
                  console.warn('GPS watchPosition error:', watchError.code, watchError.message);
                  navigator.geolocation.clearWatch(id);
                  if (!resolved) {
                    resolved = true;
                    resolve(null);
                  }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
              );
              watchId = id;
            } else {
              if (!resolved) {
                resolved = true;
                resolve(null);
              }
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      };

      doGetPosition();

      // Safety timeout: if no position after 15s, give up
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          console.warn('GPS: safety timeout reached');
          resolve(null);
        }
      }, 15000);
    });
  };

  /** Attempt IP-based geolocation as fallback (free, unlimited) */
  const locateByIP = async (): Promise<{ city: string; county: string } | null> => {
    const services = [
      // ip-api.com - works in China, free
      async () => {
        const res = await fetch('https://ip-api.com/json/?lang=zh-CN&fields=status,country,regionName,city,district,lat,lon,query');
        const data = await res.json();
        if (data.status !== 'success') return null;
        return { city: data.city || '', county: data.district || '' };
      },
      // ip.sb - works in China, free, no key
      async () => {
        const res = await fetch('https://api.ip.sb/geoip?lang=zh-CN');
        const data = await res.json();
        if (data.city) return { city: data.city || '', county: data.district || data.region || '' };
        return null;
      },
      // myip.ipip.net - works in China
      async () => {
        const res = await fetch('https://myip.ipip.net/json');
        const data = await res.json();
        if (data && data.data) {
          // Returns format: ["中国","湖南","长沙市","","电信"]
          const parts = data.data;
          if (parts.length >= 3) {
            return { city: parts[2] || '', county: parts[3] || '' };
          }
        }
        return null;
      },
      // ipapi.co - free tier
      async () => {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.error) return null;
        return { city: data.city || '', county: '' };
      }
    ];

    for (const service of services) {
      try {
        const result = await service();
        if (result && result.city) {
          console.log('IP geolocation success:', result);
          return result;
        }
      } catch (err) {
        console.warn('IP geolocation service failed:', err);
      }
    }
    return null;
  };

  const handleSimulateGPS = async () => {
    setGpsLoading(true);
    setGpsSuccess('');
    setGpsDebug('');

    try {
      // Step 1: Try GPS + reverse geocoding
      setGpsDebug('正在获取GPS定位...');
      const locationResult = await locateByGPS();

      if (locationResult && (locationResult.city || locationResult.county)) {
        const { city, county } = locationResult;
        console.log('GPS location result:', { city, county });
        setGpsDebug(`GPS坐标解析成功: 市="${city}", 县/区="${county}"`);

        // Find the best matching Hunan region
        const matchResult = findBestRegion(city, county);

        if (matchResult) {
          const { region, matchedCounty } = matchResult;
          setState(prev => ({
            ...prev,
            selectedCity: region.name,
            selectedCounty: matchedCounty
          }));
          setGpsSuccess(`已锁定定位信息：【${region.name} · ${matchedCounty || '请选择区县'}】`);
          setCityError('');
          setToastMessage('📍 物理定位已自动填入');
          setGpsLoading(false);
          return;
        } else {
          // GPS got location but not in Hunan data - show debug and picker
          setGpsDebug(prev => prev + `\n⚠️ "${city}${county}" 未匹配到湖南省内地区数据`);
          setGpsDebug(prev => prev + '\n请手动选择所在地区');
        }
      } else {
        setGpsDebug('GPS定位失败（可能被拒绝或超时）');
        setGpsDebug(prev => prev + '\n请手动选择所在地区');
      }

      // Step 2: GPS failed or not in Hunan, show manual picker
      console.log('GPS failed or not in Hunan, showing manual location picker...');

      // Step 3: Show picker
      setPickerCity('');
      setPickerCounty('');
      setLocationPickerOpen(true);
    } catch (error) {
      console.error('Geolocation error:', error);
      setGpsDebug('定位异常: ' + (error instanceof Error ? error.message : '未知错误'));
      setGpsDebug(prev => prev + '\n请手动选择所在地区');
      setPickerCity('');
      setPickerCounty('');
      setLocationPickerOpen(true);
    } finally {
      setGpsLoading(false);
    }
  };

  const handlePickerConfirm = () => {
    if (pickerCity) {
      setState(prev => ({
        ...prev,
        selectedCity: pickerCity,
        selectedCounty: pickerCounty
      }));
      setGpsSuccess(`已选择定位信息：【${pickerCity} · ${pickerCounty || '请选择区县'}】`);
      setCityError('');
      setToastMessage('📍 定位信息已手动选择');
    }
    setLocationPickerOpen(false);
  };

  /** Calculate total size of all uploaded photos in bytes */
  const getTotalPhotoSize = (): number => {
    let total = 0;
    // Sum all hazard photos
    (Object.values(state.hazards) as { checked: boolean; photos: UploadedPhoto[] }[]).forEach(h => {
      h.photos.forEach(p => {
        // base64 data URL size ≈ (base64_length * 3/4) bytes
        if (p.url) total += Math.round(p.url.length * 0.75);
      });
    });
    // Sum others photos
    state.othersPhotos.forEach(p => {
      if (p.url) total += Math.round(p.url.length * 0.75);
    });
    return total;
  };

  const handleImageUpload = async (id: number | 'others', files: FileList | null) => {
    if (!files) return;
    
    const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10MB
    const currentTotal = getTotalPhotoSize();
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setToastMessage('抱歉，只支持上传各类图像照片文件。');
        continue;
      }
      if (currentTotal + file.size > MAX_TOTAL_BYTES) {
        const remaining = MAX_TOTAL_BYTES - currentTotal;
        if (remaining <= 0) {
          setToastMessage('⚠️ 所有照片总大小已超过10MB限制，请先删除部分照片再上传');
        } else {
          setToastMessage(`⚠️ 照片总大小不能超过10MB，还能上传约 ${(remaining / 1024).toFixed(0)}KB`);
        }
        continue;
      }
      
      try {
        // 先上传到服务器
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadUrl = API_BASE ? `${API_BASE}/api/upload` : '/api/upload';
        const response = await fetchWithTimeout(uploadUrl, {
          method: 'POST',
          body: formData,
        }, 20000);
        
        if (!response.ok) {
          throw new Error(`上传失败: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.uploadUrl && !result.directSubmit) {
          throw new Error('上传响应格式错误');
        }
        
        // 如果后端返回 directSubmit=true，说明使用 base64（降级方案）
        let photoUrl = result.uploadUrl || result.publicUrl;
        if (result.directSubmit) {
          // 降级：使用 base64
          const reader = new FileReader();
          const base64data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          photoUrl = base64data;
        }
        
        const uniqueId = Math.random().toString(36).substring(2, 9);
        const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        
        const photo: UploadedPhoto = {
          id: uniqueId,
          name: file.name,
          url: photoUrl,
          size: sizeStr
        };
        
        if (id === 'others') {
          setState(prev => ({
            ...prev,
            othersPhotos: [...prev.othersPhotos, photo]
          }));
        } else {
          setState(prev => {
            const currentObj = prev.hazards[id];
            return {
              ...prev,
              hazards: {
                ...prev.hazards,
                [id]: {
                  ...currentObj,
                  photos: [...currentObj.photos, photo]
                }
              }
            };
          });
        }
        setToastMessage('📷 照片上传成功');
      } catch (error) {
        console.error('Upload error:', error);
        setToastMessage('⚠️ 上传失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }
    }
  };

  const handleRemovePhoto = (id: number | 'others', photoId: string) => {
    if (id === 'others') {
      setState(prev => ({
        ...prev,
        othersPhotos: prev.othersPhotos.filter(p => p.id !== photoId)
      }));
    } else {
      setState(prev => {
        const currentObj = prev.hazards[id];
        return {
          ...prev,
          hazards: {
            ...prev.hazards,
            [id]: {
              ...currentObj,
              photos: currentObj.photos.filter(p => p.id !== photoId)
            }
          }
        };
      });
    }
  };

  const validateUserInfo = (): boolean => {
    setFormAttempted(true);
    let valid = true;

    if (!state.reporterName.trim()) {
      setNameError('请填入您的姓氏称呼。');
      valid = false;
    } else {
      setNameError('');
    }

    if (state.reporterPhone.length !== 11) {
      setPhoneError('联系方式必须为11位完整的手机号码。');
      valid = false;
    } else {
      setPhoneError('');
    }

    if (!state.selectedCity || !state.selectedCounty) {
      setCityError('定位信息不能为空，请选择市/县。');
      valid = false;
    } else {
      setCityError('');
    }

    if (!state.cinemaName.trim()) {
      setCinemaError('请提供发生隐患影院的具体名称。');
      valid = false;
    } else {
      setCinemaError('');
    }

    return valid;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!validateUserInfo()) {
        setToastMessage('⚠️ 请检查并完善标红项的信息');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTrySubmit = () => {
    const checkedHazardsCount = getHazardsList().filter(h => h.checked).length;
    const hasOthers = state.othersText.trim().length > 0;
    
    if (checkedHazardsCount === 0 && !hasOthers) {
      setToastMessage('请至少勾选或补充一个具体的安全隐患项目');
      return;
    }

    let missingPhotos = false;
    getHazardsList().forEach((value) => {
      if (value.checked && value.photos.length === 0) {
        missingPhotos = true;
      }
    });

    if (missingPhotos) {
      setToastMessage('💡 温馨提示：为隐患附上现场实拍照片，核实速度和有效性会大幅提升！');
    }

    setConfirmModalOpen(true);
  };

  const handleCancelAndExit = () => {
    if (window.confirm('您确定要放弃并清空当前的填写记录吗？')) {
      clearDraft();
      setState({
        reporterName: '',
        reporterTitle: '',
        reporterPhone: '',
        selectedCity: '',
        selectedCounty: '',
        cinemaName: '',
        hazards: {
          5: { checked: false, photos: [] },
          6: { checked: false, photos: [] },
          7: { checked: false, photos: [] },
          8: { checked: false, photos: [] },
          9: { checked: false, photos: [] },
          10: { checked: false, photos: [] },
          16: { checked: false, photos: [] },
          12: { checked: false, photos: [] },
          13: { checked: false, photos: [] },
          11: { checked: false, photos: [] },
          14: { checked: false, photos: [] },
          15: { checked: false, photos: [] },
        },
        othersText: '',
        othersPhotos: []
      });
      setFormAttempted(false);
      setNameError('');
      setPhoneError('');
      setCityError('');
      setCinemaError('');
      setConfirmModalOpen(false);
      setCurrentStep(0);
      setToastMessage('填写已安全重置');
    }
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    
    try {
      // 构建提交数据，只发送必要的字段
      const payload = {
        reporterName: state.reporterName,
        reporterTitle: state.reporterTitle,
        reporterPhone: state.reporterPhone,
        selectedCity: state.selectedCity,
        selectedCounty: state.selectedCounty,
        cinemaName: state.cinemaName,
        hazards: state.hazards,
        othersText: state.othersText,
        photos: [] as { url: string }[],
        othersPhotos: state.othersPhotos.map(p => ({ url: p.url })),
      };

      // 收集所有勾选隐患的照片（只保留 URL）
      (Object.entries(state.hazards) as [string, { checked: boolean; photos: { id: string; name: string; url: string; size: string }[] }][]).forEach(([key, val]) => {
        if (val.checked) {
          payload.photos.push(...val.photos.map(p => ({ url: p.url })));
        }
      });

      // 发送到后端 API（带 20 秒超时，防止"半天没反应"）
      const apiUrl = API_BASE ? `${API_BASE}/api/submit` : '/api/submit';
      let response: Response;
      try {
        response = await fetchWithTimeout(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }, 20000);
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          throw new Error('请求超时，请检查网络连接或稍后重试');
        }
        throw new Error('网络请求失败: ' + (fetchErr.message || '未知错误'));
      }

      // 检查 HTTP 状态码
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`服务器返回错误 (${response.status}): ${errorText || response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '提交失败');
      }

      // 同时保存到本地历史记录
      const newSubmission: SurveySubmission = {
        id: result.id,
        timestamp: new Date().toISOString(),
        state: state,
        status: 'pending',
        rewardAmount: 0,
      };

      const updatedSubmissions = [newSubmission, ...submissions];
      saveSubmissions(updatedSubmissions);
      clearDraft();
      
      setSubmitting(false);
      setConfirmModalOpen(false);
      setCurrentStep(3);
      setToastMessage('✅ 提交成功，感谢您的热心监督！');
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitting(false);
      setConfirmModalOpen(false);
      // 显示更详细的错误信息
      const errMsg = error instanceof Error ? error.message : '未知错误';
      setToastMessage('⚠️ 提交失败: ' + errMsg);
    }
  };

  const handleDeleteStub = async (id: number) => {
    // 同步删除后端数据
    try {
      await fetchWithTimeout(`${API_BASE}/api/delete-by-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }, 10000);
    } catch (err) {
      console.warn('后端删除同步失败（不影响本地删除）:', err);
    }
    
    // 本地删除
    const nextList = submissions.filter(s => s.id !== id);
    saveSubmissions(nextList);
    setToastMessage('已删除该条记录');
  };

  const getProgressPercent = () => {
    if (currentStep === 0) return 5;
    if (currentStep === 1) return 40;
    if (currentStep === 2) return 80;
    if (currentStep === 3) return 100;
    return 0;
  };

  return (
    <div className={`min-h-screen pb-24 transition-colors duration-300 ${
        darkMode 
          ? 'bg-gray-900 text-gray-100' 
          : 'bg-gray-50 text-gray-900'
      }`}>
      
      {/* 极简顶导栏 */}
      <header className={`sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6 shadow-sm transition-colors duration-300 ${
          darkMode 
            ? 'bg-gray-800 border-b border-gray-700' 
            : 'bg-white border-b border-gray-200'
        }`}>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0" />
          <h1 className={`text-lg font-semibold tracking-tight select-none transition-colors duration-300 ${
            darkMode ? 'text-gray-100' : 'text-gray-900'
          }`}>影院安全隐患举报</h1>
        </div>

        <div className="hidden sm:block flex-1 max-w-md mx-8">
          {currentStep > 0 && currentStep < 3 && (
            <div className="flex items-center gap-3 w-full">
              <span className={`text-xs min-w-max font-medium transition-colors duration-300 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>当前进度</span>
              <div className={`w-full h-2 rounded-full overflow-hidden transition-colors duration-300 ${
                darkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <div 
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${getProgressPercent()}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Dark/Light Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            style={{ backgroundColor: darkMode ? '#3b82f6' : '#d1d5db' }}
            aria-label={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm flex items-center justify-center transition-transform duration-300 ${
                darkMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              {darkMode ? (
                <Moon className="w-3 h-3 text-blue-600" />
              ) : (
                <Sun className="w-3 h-3 text-amber-500" />
              )}
            </span>
          </button>

          {submissions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3.5 py-2 flex items-center gap-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                darkMode 
                  ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' 
                  : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>历史记录 ({submissions.length})</span>
            </button>
          )}
        </div>
      </header>

      {/* 移动端顶导进度条补偿 */}
      <div className={`h-1 w-full sm:hidden transition-colors duration-300 ${
          darkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
        <div 
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${getProgressPercent()}%` }}
        />
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 backdrop-blur shadow-xl px-5 py-3.5 rounded-xl flex items-center gap-3 text-sm max-w-md w-[85%] transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-800/95 text-gray-100 border border-gray-700' 
                : 'bg-gray-900/95 text-white'
            }`}
          >
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="container max-w-2xl mx-auto px-4 pt-8 md:pt-12">
        
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <ReportingHistory 
                submissions={submissions}
                onDelete={handleDeleteStub}
                onClose={() => setShowHistory(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 0 - 欢迎引导 */}
        {currentStep === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="p-8 md:p-12 text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transform -rotate-3 transition-colors duration-300 ${
                  darkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-semibold text-blue-600">湖南省电影局</div>
                  <div className="text-lg font-medium text-blue-600">湖南省电影行业协会</div>
                </div>
              </div>
              <h1 className={`text-3xl font-bold mb-4 tracking-tight transition-colors duration-300 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>影院安全隐患举报</h1>
              <p className={`leading-relaxed max-w-lg mx-auto mb-8 transition-colors duration-300 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                欢迎参与影院公共安全共治活动。用十秒钟记录并扫除身边的隐患盲点，核实有效的首发举报可获得 <span className="font-semibold text-blue-600">￥100元现金感谢金</span>。
              </p>

              <div className={`rounded-xl p-5 mb-10 text-left border flex gap-3 text-sm leading-relaxed shadow-inner transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600 text-gray-300' 
                  : 'bg-gray-50 border-gray-100 text-gray-600'
              }`}>
                <Info className={`w-5 h-5 shrink-0 mt-0.5 ${
                  darkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
                <div>
                  <strong className={`block mb-1 transition-colors duration-300 ${
                    darkMode ? 'text-gray-200' : 'text-gray-900'
                  }`}>隐私保密声明</strong>
                  所有举报人的实名制信息与现场存证照片我们将做极其严格的保密与脱敏加密处理。仅做验证、发奖之用，请放心填报。
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleNextStep}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2 hover:shadow-md"
                >
                  我要填报
                  <ChevronRight className="w-4 h-4 opacity-80" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 1 - 基本信息 */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`rounded-2xl shadow-sm border p-6 md:p-10 transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="mb-8">
              <h2 className={`text-2xl font-bold transition-colors duration-300 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>联络人与影院归属</h2>
              <p className={`mt-2 text-sm transition-colors duration-300 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>此信息严格保密，仅用于隐患核查反馈及奖励的及时送达。</p>
            </div>

            <div className="space-y-7">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <label className={`text-sm font-medium flex items-center gap-1 transition-colors duration-300 ${
                    darkMode ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    怎么称呼您？ <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="您的姓氏，如：陈"
                      value={state.reporterName}
                      onChange={(e) => {
                        setState(prev => ({ ...prev, reporterName: e.target.value }));
                        if (nameError) setNameError('');
                      }}
                      className={`flex-1 w-full rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border border-gray-600 text-gray-100 placeholder:text-gray-500' 
                          : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400'
                      }`}
                    />
                    <div className={`flex p-1 rounded-xl transition-colors duration-300 ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      {['先生', '女士'].map((title) => (
                        <button
                          key={title}
                          onClick={() => setState(prev => ({ ...prev, reporterTitle: title as '先生' | '女士' }))}
                          className={`px-4 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                            state.reporterTitle === title
                              ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                              : darkMode 
                                ? 'text-gray-400 hover:text-gray-200' 
                                : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>
                  {nameError && <p className="text-xs font-medium text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {nameError}</p>}
                </div>

                <div className="space-y-2.5">
                  <label className={`text-sm font-medium flex items-center gap-1 transition-colors duration-300 ${
                    darkMode ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    手机号码 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="tel"
                    maxLength={11}
                    placeholder="请输入11位联络方式"
                    value={state.reporterPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`w-full rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                      darkMode 
                        ? 'bg-gray-700 border border-gray-600 text-gray-100 placeholder:text-gray-500' 
                        : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                  {phoneError && <p className="text-xs font-medium text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {phoneError}</p>}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className={`text-sm font-medium flex items-center gap-1 transition-colors duration-300 ${
                  darkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  所在市县定位 <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <select
                      value={state.selectedCity}
                      onChange={(e) => {
                        setState(prev => ({ ...prev, selectedCity: e.target.value, selectedCounty: '' }));
                        setCityError('');
                      }}
                      className={`w-full appearance-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border border-gray-600 text-gray-100' 
                          : 'bg-white border border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">省辖市级选择</option>
                      {HUNAN_REGIONS.map((region) => (
                        <option key={region.name} value={region.name}>{region.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <select
                      value={state.selectedCounty}
                      disabled={!state.selectedCity}
                      onChange={(e) => {
                        setState(prev => ({ ...prev, selectedCounty: e.target.value }));
                        setCityError('');
                      }}
                      className={`w-full appearance-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                        darkMode 
                          ? 'bg-gray-700 border border-gray-600 text-gray-100 disabled:bg-gray-800 disabled:text-gray-500' 
                          : 'bg-white border border-gray-300 text-gray-900 disabled:bg-gray-50 disabled:text-gray-400'
                      }`}
                    >
                      <option value="">县辖区级选择</option>
                      {state.selectedCity && 
                        HUNAN_REGIONS.find(r => r.name === state.selectedCity)?.counties.map((county) => (
                          <option key={county} value={county}>{county}</option>
                        ))
                      }
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                {cityError && <p className="text-xs font-medium text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {cityError}</p>}
                {gpsSuccess && <p className={`text-xs font-medium flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg border w-fit transition-colors duration-300 ${
                  darkMode 
                    ? 'text-green-400 bg-green-900/30 border-green-800' 
                    : 'text-green-600 bg-green-50 border-green-100'
                }`}><Check className="w-4 h-4" /> {gpsSuccess}</p>}
                {gpsDebug && !gpsSuccess && (
                  <pre className={`text-[11px] mt-2 rounded-lg px-3 py-2 whitespace-pre-wrap font-mono transition-colors duration-300 ${
                    darkMode 
                      ? 'text-gray-400 bg-gray-700 border border-gray-600' 
                      : 'text-gray-500 bg-gray-50 border border-gray-200'
                  }`}>{gpsDebug}</pre>
                )}
              </div>

              <div className="space-y-2.5 pt-2">
                <label className={`text-sm font-medium flex items-center gap-1 transition-colors duration-300 ${
                  darkMode ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  隐患发生具体影院名字 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="例：万达影城、中影国际影城（商场店）"
                    value={state.cinemaName}
                    onChange={(e) => {
                      setState(prev => ({ ...prev, cinemaName: e.target.value }));
                      if (cinemaError) setCinemaError('');
                    }}
                    className={`w-full rounded-xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                      darkMode 
                        ? 'bg-gray-700 border border-gray-600 text-gray-100 placeholder:text-gray-500' 
                        : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400'
                    }`}
                  />
                </div>
                {cinemaError && <p className="text-xs font-medium text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" /> {cinemaError}</p>}
              </div>
            </div>

            <div className={`mt-10 flex justify-between items-center pt-6 border-t transition-colors duration-300 ${
              darkMode ? 'border-gray-700' : 'border-gray-100'
            }`}>
              <button
                onClick={() => setCurrentStep(0)}
                className={`px-5 py-2.5 font-medium transition-colors flex items-center gap-1.5 rounded-xl text-sm ${
                  darkMode 
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft className="w-4 h-4" /> 退回主页
              </button>
              <button
                onClick={handleNextStep}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-all flex items-center gap-2 hover:shadow-md active:scale-95"
              >
                下一步 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2 - 安全隐患项目勾选 */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className={`rounded-2xl shadow-sm border p-6 md:p-10 transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <div className="mb-8">
                <h2 className={`text-2xl font-bold transition-colors duration-300 ${
                  darkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>对照核验并录入隐患</h2>
                <p className={`mt-2 text-sm transition-colors duration-300 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>核验单列表，勾选符合现场实际情况的问题条目。</p>
              </div>

              <div className="space-y-4">
                {HAZARDS_DEFINITIONS.map((def: HazardDefinition) => {
                  const questionState = state.hazards[def.id];
                  
                  return (
                    <div 
                      key={def.id}
                      className={`border rounded-xl transition-all duration-300 ${
                        questionState.checked 
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                          : darkMode
                            ? 'border-gray-600 hover:border-gray-500 bg-gray-800'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="p-5 flex items-start gap-4">
                        <button
                          onClick={() => {
                            setState(prev => {
                              const hazardObj = prev.hazards[def.id];
                              return { ...prev, hazards: { ...prev.hazards, [def.id]: { ...hazardObj, checked: !hazardObj.checked } } };
                            });
                          }}
                          className={`w-6 h-6 mt-0.5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            questionState.checked 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                          }`}
                        >
                          <Check className="w-4 h-4 font-bold" />
                        </button>

                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-[15px] mb-1 transition-colors duration-300 ${
                            darkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>{def.label}</h4>
                          <p className={`text-sm leading-relaxed max-w-lg transition-colors duration-300 ${
                            darkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>{def.details}</p>

                          <AnimatePresence>
                            {questionState.checked && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden mt-4 pt-4 border-t border-blue-100"
                              >
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className={`font-medium flex items-center gap-1.5 transition-colors duration-300 ${
                                      darkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      <Camera className="w-4 h-4 text-gray-400" />
                                      增补照片指证材料 (强力推荐)
                                    </span>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors duration-300 ${
                                      darkMode ? 'text-blue-300 bg-blue-900/30' : 'text-blue-700 bg-blue-100/50'
                                    }`}>已传 {questionState.photos.length} 帧</span>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    {questionState.photos.map((photo) => (
                                      <div key={photo.id} className={`w-20 h-20 rounded-xl border overflow-hidden relative group shadow-sm transition-colors duration-300 ${
                                        darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'
                                      }`}>
                                        <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                                        <button
                                          onClick={() => handleRemovePhoto(def.id, photo.id)}
                                          className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                        >
                                          <Trash2 className="w-5 h-5 text-white hover:text-red-400" />
                                        </button>
                                      </div>
                                    ))}

                                    <button
                                      onClick={() => fileInputRefs.current[def.id]?.click()}
                                      className={`w-20 h-20 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors shadow-sm ${
                                        darkMode 
                                          ? 'border-gray-500 bg-gray-700 hover:bg-gray-600 hover:border-gray-400 text-gray-400' 
                                          : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-500'
                                      }`}
                                    >
                                      <Plus className="w-5 h-5" />
                                      <span className="text-[11px] font-medium">选相册</span>
                                    </button>

                                    <input 
                                      ref={el => fileInputRefs.current[def.id] = el}
                                      type="file" multiple accept="image/*" 
                                      onChange={(e) => handleImageUpload(def.id, e.target.files)}
                                      className="hidden"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Others Section */}
              <div className={`mt-8 border rounded-xl p-6 transition-colors duration-300 ${
                darkMode 
                  ? 'border-gray-600 bg-gray-700/50' 
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="mb-4">
                  <h4 className={`font-semibold flex items-center gap-2 text-[15px] transition-colors duration-300 ${
                    darkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    <AlertCircle className={`w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                     其它与建筑安全、消防安全、食品安全有关隐患
                  </h4>
                </div>
                
                <textarea
                  rows={4}
                  placeholder="如发现其他与建筑安全、消防安全、食品安全有关的隐患，请在这里简单叙述..."
                  value={state.othersText}
                  onChange={(e) => setState(prev => ({ ...prev, othersText: e.target.value }))}
                  className={`w-full rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm mb-4 shadow-sm ${
                    darkMode 
                      ? 'bg-gray-800 border border-gray-600 text-gray-100 placeholder:text-gray-500' 
                      : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400'
                  }`}
                />

                <div className={`pt-4 border-t transition-colors duration-300 ${
                  darkMode ? 'border-gray-600' : 'border-gray-200'
                }`}>
                  <span className={`font-medium text-sm mb-3 block transition-colors duration-300 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>隐患配图与材料证明：</span>
                  <div className="flex flex-wrap gap-3">
                    {state.othersPhotos.map((photo) => (
                      <div key={photo.id} className={`w-20 h-20 rounded-xl border overflow-hidden relative group shadow-sm transition-colors duration-300 ${
                        darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200'
                      }`}>
                        <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemovePhoto('others', photo.id)}
                          className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <Trash2 className="w-5 h-5 text-white hover:text-red-400" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => fileInputRefs.current['others']?.click()}
                      className={`w-20 h-20 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors shadow-sm ${
                        darkMode 
                          ? 'border-gray-500 bg-gray-700 hover:bg-gray-600 text-gray-400' 
                          : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[11px] font-medium">添相片</span>
                    </button>

                    <input 
                      ref={el => fileInputRefs.current['others'] = el}
                      type="file" multiple accept="image/*" 
                      onChange={(e) => handleImageUpload('others', e.target.files)}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div className={`mt-10 flex justify-between items-center pt-6 border-t transition-colors duration-300 ${
                darkMode ? 'border-gray-700' : 'border-gray-100'
              }`}>
                <button
                  onClick={handlePrevStep}
                  className={`px-5 py-2.5 font-medium transition-colors flex items-center gap-1.5 rounded-xl text-sm ${
                    darkMode 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" /> 返回上步
                </button>
                <button
                  onClick={handleTrySubmit}
                  className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-all active:scale-95 flex items-center gap-2 hover:shadow-md"
                >
                  确认打包提交
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3 - 成功反馈卡片 */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-sm border overflow-hidden transition-colors duration-300 ${
              darkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
          >
            <div className={`px-6 py-12 border-b text-center transition-colors duration-300 ${
              darkMode 
                ? 'bg-green-900/30 border-green-800' 
                : 'bg-green-50 border-green-100'
            }`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm transition-colors duration-300 ${
                darkMode ? 'bg-gray-800' : 'bg-white'
              }`}>
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className={`text-2xl md:text-3xl font-bold transition-colors duration-300 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>卷宗提交成功</h2>
              <p className={`mt-3 font-medium text-sm transition-colors duration-300 ${
                darkMode ? 'text-green-400/80' : 'text-green-800/80'
              }`}>核实工作正进入受理中控台，感谢您的热心配合。</p>
            </div>

            <div className="p-8 md:p-12 text-center flex flex-col items-center">
              <div className={`w-full max-w-sm rounded-2xl p-6 text-left mb-8 shadow-inner transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-700/50 border border-gray-600' 
                  : 'bg-gray-50 border border-gray-100'
              }`}>
                <div className={`text-xs font-mono tracking-wider mb-4 pb-4 flex items-center justify-between transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-500 border-b border-gray-600/60' 
                    : 'text-gray-400 border-b border-gray-200/60'
                }`}>
                  <span>单据票号</span>
                  <span>HN-{submissions[0]?.id ? String(submissions[0].id).padStart(6, '0') : '------'}</span>
                </div>
                <div className={`space-y-3.5 text-sm font-medium transition-colors duration-300 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>实名提报人</span>
                    <span className={darkMode ? 'text-gray-200' : 'text-gray-900'}>{state.reporterName}{state.reporterTitle}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>核对电话</span>
                    <span className={darkMode ? 'text-gray-200' : 'text-gray-900'}>{state.reporterPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>提报地点</span>
                    <span className={darkMode ? 'text-gray-200' : 'text-gray-900'}>{state.selectedCity} · {state.cinemaName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={darkMode ? 'text-gray-500' : 'text-gray-500'}>共计报备条目</span>
                    <span className="text-blue-600">{getHazardsList().filter(h => h.checked).length + (state.othersText.trim() ? 1 : 0)} 项</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-xs sm:max-w-md mx-auto">
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-all hover:shadow-md"
                >
                  追踪提报记录
                </button>
                <button
                  onClick={() => {
                    setSubmitting(false);
                    clearDraft();
                    setState({
                      reporterName: '', reporterTitle: '', reporterPhone: '', selectedCity: '', selectedCounty: '', cinemaName: '',
                      hazards: { 5: { checked: false, photos: [] }, 6: { checked: false, photos: [] }, 7: { checked: false, photos: [] }, 8: { checked: false, photos: [] }, 9: { checked: false, photos: [] }, 10: { checked: false, photos: [] }, 16: { checked: false, photos: [] }, 12: { checked: false, photos: [] }, 13: { checked: false, photos: [] }, 11: { checked: false, photos: [] }, 14: { checked: false, photos: [] }, 15: { checked: false, photos: [] } },
                      othersText: '', othersPhotos: []
                    });
                    setFormAttempted(false);
                    setCurrentStep(0);
                  }}
                  className={`w-full py-3.5 rounded-xl font-medium transition-colors ${
                    darkMode 
                      ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' 
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  新启巡查反馈
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* LOCATION PICKER MODAL (fallback when GPS fails) */}
      <AnimatePresence>
        {locationPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setLocationPickerOpen(false)}
              className="absolute inset-0 bg-gray-900"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl shadow-xl p-6 sm:p-8 z-10 mx-auto transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-800 border border-gray-700' 
                  : 'bg-white'
              }`}
            >
              <h3 className={`text-xl font-bold mb-1.5 transition-colors duration-300 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>📍 选择所在地区</h3>
              <p className={`text-sm mb-6 transition-colors duration-300 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>自动定位失败，请手动选择您所在的市和区县：</p>

              <div className="space-y-4">
                <div className="relative">
                  <select
                    value={pickerCity}
                    onChange={(e) => { setPickerCity(e.target.value); setPickerCounty(''); }}
                    className={`w-full appearance-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                      darkMode 
                        ? 'bg-gray-700 border border-gray-600 text-gray-100' 
                        : 'bg-white border border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">选择市/州</option>
                    {HUNAN_REGIONS.map((region) => (
                      <option key={region.name} value={region.name}>{region.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={pickerCounty}
                    disabled={!pickerCity}
                    onChange={(e) => setPickerCounty(e.target.value)}
                    className={`w-full appearance-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                      darkMode 
                        ? 'bg-gray-700 border border-gray-600 text-gray-100 disabled:bg-gray-800 disabled:text-gray-500' 
                        : 'bg-white border border-gray-300 text-gray-900 disabled:bg-gray-50 disabled:text-gray-400'
                    }`}
                  >
                    <option value="">选择区/县</option>
                    {pickerCity && 
                      HUNAN_REGIONS.find(r => r.name === pickerCity)?.counties.map((county) => (
                        <option key={county} value={county}>{county}</option>
                      ))
                    }
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setLocationPickerOpen(false)}
                  className={`flex-1 py-3 rounded-xl transition-colors text-sm font-medium ${
                    darkMode 
                      ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' 
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={handlePickerConfirm}
                  disabled={!pickerCity}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认选择
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION POPUP MODAL */}
      <AnimatePresence>
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModalOpen(false)}
              className="absolute inset-0 bg-gray-900"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className={`relative w-full max-w-md rounded-2xl shadow-xl p-6 sm:p-8 z-10 mx-auto transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-800 border border-gray-700' 
                  : 'bg-white'
              }`}
            >
              <h3 className={`text-xl font-bold mb-1.5 transition-colors duration-300 ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>准备发包提交</h3>
              <p className={`text-sm mb-6 transition-colors duration-300 ${
                darkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>请核实下列报单情况是否与现状相符：</p>

              <div className={`rounded-xl border p-4 mb-8 space-y-3 text-sm shadow-inner transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-700/50 border-gray-600 text-gray-300' 
                  : 'bg-gray-50 border-gray-100 text-gray-700'
              }`}>
                <div className={`pb-3 flex justify-between items-center text-xs transition-colors duration-300 ${
                  darkMode ? 'border-b border-gray-600' : 'border-b border-gray-200'
                }`}>
                  <span className={`font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{state.selectedCity} · {state.selectedCounty}</span>
                  <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{state.cinemaName}</span>
                </div>
                <p><span className={`w-16 inline-block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>联系姓名</span> <strong className={darkMode ? 'text-gray-200' : ''}>{state.reporterName}</strong> {state.reporterTitle}</p>
                <p><span className={`w-16 inline-block ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>拨打号码</span> <strong className={darkMode ? 'text-gray-200' : ''}>{state.reporterPhone}</strong></p>
                <p><span className="text-gray-500 w-16 inline-block">异常项录</span> 共记录 <span className="text-blue-600 font-bold">{getHazardsList().filter(h => h.checked).length + (state.othersText.trim() ? 1 : 0)}</span> 项问题</p>
                <p><span className="text-gray-500 w-16 inline-block">凭证相片</span> 共拍摄 <span className="text-blue-600 font-bold">{getHazardsList().reduce((acc, h) => acc + h.photos.length, 0) + state.othersPhotos.length}</span> 张底料</p>
              </div>

              <div className="space-y-3 font-medium">
                <button
                  onClick={handleConfirmSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? '提报数据加密传输中...' : '提交隐患举报'}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModalOpen(false)}
                    disabled={submitting}
                    className={`flex-1 py-3 rounded-xl transition-colors ${
                      darkMode 
                        ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600' 
                        : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    取消申请
                  </button>
                  <button
                    onClick={handleCancelAndExit}
                    disabled={submitting}
                    className={`flex-1 py-3 rounded-xl transition-colors border ${
                      darkMode 
                        ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border-red-800' 
                        : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-100'
                    }`}
                  >
                    终止
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className={`mt-20 py-6 flex flex-col items-center justify-center text-xs transition-colors duration-300 ${
        darkMode 
          ? 'border-t border-gray-700 bg-gray-800 text-gray-500' 
          : 'border-t border-gray-200 bg-white text-gray-400'
      }`}>
        <p className="mb-2">湖南省电影局 · 湖南省电影行业协会 监制</p>
        <p>为创造放心舒适的公共观影环境共同发声举报</p>
      </footer>
    </div>
  );
}
