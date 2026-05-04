import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/core/providers/UserContext';

/** "25" → "2001-01-01" — used when only age is captured, not DOB. */
function ageToDob(age: string): string {
  const n = Number.parseInt(age, 10);
  if (!Number.isFinite(n) || n < 16 || n > 90) return '2000-01-01';
  return `${new Date().getFullYear() - n}-01-01`;
}

export interface PersonalFormState {
  profilePhoto: string | null;
  fullName: string;
  email: string;
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  dob: string;
  address: string;
  state: string;
  district: string;
  city: string;
  pincode: string;
}

const PINCODE_PREFIXES: Record<string, string[]> = {
  'Delhi': ['11'], 'Haryana': ['12', '13'], 'Punjab': ['14', '15', '16'], 'Himachal Pradesh': ['17'],
  'Jammu & Kashmir': ['18', '19'], 'Uttar Pradesh': ['20', '21', '22', '23', '24', '25', '26', '27', '28'],
  'Rajasthan': ['30', '31', '32', '33', '34'], 'Gujarat': ['36', '37', '38', '39'],
  'Maharashtra': ['40', '41', '42', '43', '44'], 'Madhya Pradesh': ['45', '46', '47', '48'],
  'Chhattisgarh': ['49'], 'Andhra Pradesh': ['50', '51', '52', '53'], 'Karnataka': ['56', '57', '58', '59'],
  'Tamil Nadu': ['60', '61', '62', '63', '64'], 'Kerala': ['67', '68', '69'], 'West Bengal': ['70', '71', '72', '73', '74'],
  'Odisha': ['75', '76', '77'], 'Assam': ['78'], 'Bihar': ['80', '81', '82', '83', '84', '85']
};

export const usePersonalForm = () => {
  const { updateRiderName, setProfileImage } = useUser();
  const [form, setForm] = useState<PersonalFormState>({
    profilePhoto: null,
    fullName: '',
    email: '',
    age: '',
    gender: '',
    dob: '',
    address: '',
    state: '',
    district: '',
    city: '',
    pincode: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePincode = useCallback((pincode: string, state: string) => {
    if (!pincode) return null;
    if (pincode.length !== 6) return "Must be 6 digits";
    if (state && PINCODE_PREFIXES[state]) {
      const match = PINCODE_PREFIXES[state].some(p => pincode.startsWith(p));
      if (!match) return `Wrong state for this code`;
    }
    return null;
  }, []);

  const updateForm = useCallback((updates: Partial<PersonalFormState>) => {
    setForm(prev => {
      const next = { ...prev, ...updates };
      
      // Sanitization
      if (updates.fullName !== undefined) next.fullName = updates.fullName.replace(/[^a-zA-Z\s]/g, '');
      if (updates.age !== undefined) next.age = updates.age.replace(/[^0-9]/g, '');
      if (updates.pincode !== undefined) next.pincode = updates.pincode.replace(/[^0-9]/g, '');
      if (updates.email !== undefined) next.email = updates.email.trim().toLowerCase();

      // Side-effect: Clear pincode error if state changes and matches
      if (updates.state || updates.pincode) {
        const pinError = validatePincode(next.pincode, next.state);
        setErrors(prevErrors => {
          const { pincode: _, ...rest } = prevErrors;
          return pinError ? { ...rest, pincode: pinError } : rest;
        });
      }

      return next;
    });
  }, [validatePincode]);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!form.fullName || form.fullName.length < 3) newErrors.fullName = "Invalid Name";
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid Email Address";
    if (!form.age || parseInt(form.age) < 18) newErrors.age = "Must be 18+";
    
    const pinErr = validatePincode(form.pincode, form.state);
    if (pinErr) newErrors.pincode = pinErr;
    else if (!form.pincode) newErrors.pincode = "Required";

    setErrors(newErrors);
    return !!(
      form.profilePhoto && form.fullName && form.email && form.age && form.gender && 
      form.dob && form.address && form.state && form.city && form.pincode &&
      Object.keys(newErrors).length === 0
    );
  }, [form, validatePincode]);

  const loadData = useCallback(async () => {
    const savedData = await AsyncStorage.getItem('@personal_data');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setForm(prev => ({ ...prev, ...parsed }));
    }
    const savedPhoto = await AsyncStorage.getItem('@kyc_profile_photo');
    if (savedPhoto) setForm(prev => ({ ...prev, profilePhoto: savedPhoto }));
  }, []);

  const saveData = useCallback(async () => {
    if (!validate()) return false;

    // 1. Local cache for offline cold-starts.
    await AsyncStorage.setItem('@personal_data', JSON.stringify({ ...form, completed: true }));

    // 2. Sync UserContext.
    if (form.fullName) {
      await updateRiderName(form.fullName);
    }
    if (form.profilePhoto) {
      await setProfileImage(form.profilePhoto);
    }

    // 3. Server-side persistence — POST /kyc/personal.
    try {
      const { kycService, uploadKycDocument } = await import('@/services/api/features/kyc');

      // 3a. If we captured a profile photo locally (file://), upload it to S3
      //     and submit it as the KYC selfie via /kyc/documents.
      if (form.profilePhoto && form.profilePhoto.startsWith('file:')) {
        try {
          const selfieUrl = await uploadKycDocument('selfie', form.profilePhoto);
          await kycService.setDocuments({ selfie: selfieUrl });
        } catch (e) {
          // Non-fatal: continue with personal save; the rider can re-capture later.
          if (__DEV__) console.warn('selfie upload failed:', (e as Error).message);
        }
      }

      // 3b. Personal-data POST.
      const dob = form.dob && form.dob.match(/^\d{4}-\d{2}-\d{2}$/)
        ? form.dob
        : ageToDob(form.age);
      const gender: 'male' | 'female' | 'other' = (form.gender || 'other') as 'male' | 'female' | 'other';
      await kycService.setPersonal({
        fullName: form.fullName,
        ...(form.email ? { email: form.email } : {}),
        dateOfBirth: dob,
        gender,
        address: {
          line1: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          ...(form.district ? { district: form.district } : {}),
        },
      });
    } catch (e: unknown) {
      // Server-side save failure isn't fatal for the local flow — the rider
      // can re-finalize from ReviewScreen which retries.
      if (__DEV__) console.warn('Personal POST failed:', (e as Error).message);
      return true;
    }

    return true;
  }, [form, validate, updateRiderName, setProfileImage]);

  return { form, errors, updateForm, validate, loadData, saveData };
};
