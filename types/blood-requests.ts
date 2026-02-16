export type RequestStatus = "pending" | "accepted" | "rejected" | "completed";

export interface BloodRequest {
    id: string;
    patient_id: string;
    clinic_id?: string;
    status: RequestStatus;
    appointment_date?: string;
    donation_completed?: boolean;
    donor_matched_id?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
