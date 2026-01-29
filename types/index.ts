// Firestore Data Model Types

export interface DonorData {
  id: string;
  d_name?: string;
  d_city?: string;
  d_bloodgroup?: string;
  d_phone?: string;
  d_email?: string;
  d_age?: number;
  d_weight?: number;
  d_breed?: string;
  d_gender?: string;
  d_pincode?: string;
  d_address?: string;
  d_lastDonation?: any;
  onboarded?: string;
  role?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface PatientData {
  id: string;
  p_name?: string;
  p_city?: string;
  p_bloodgroup?: string;
  p_phone?: string;
  p_email?: string;
  p_age?: number;
  p_weight?: number;
  p_breed?: string;
  p_gender?: string;
  p_pincode?: string;
  p_address?: string;
  p_urgencyRequirment?: string;
  onboarded?: string;
  role?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface VeterinaryData {
  id: string;
  v_name?: string;
  v_city?: string;
  v_email?: string;
  v_phone?: string;
  v_address?: string;
  v_pincode?: string;
  onboarded?: string;
  role?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface OrganisationData {
  id: string;
  o_name?: string;
  o_city?: string;
  o_email?: string;
  o_phone?: string;
  o_address?: string;
  o_pincode?: string;
  onboarded?: string;
  role?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface DonationRecord {
  id: string;
  donorId: string;
  patientId: string;
  donationDate: any;
  bloodType?: string;
  amount?: string;
  status?: string;
  createdAt?: any;
  [key: string]: any;
}

export interface AppointmentData {
  id: string;
  donorId: string;
  patientId?: string;
  appointmentDate: any;
  status?: string;
  location?: string;
  notes?: string;
  createdAt?: any;
  [key: string]: any;
}

export type UserData = DonorData | PatientData | VeterinaryData | OrganisationData;
