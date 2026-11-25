/**
 * Shared database types for the Supabase project.
 * Column names intentionally match SQL exactly (snake_case); dates, times,
 * numeric values, and UUIDs are represented as strings.
 *
 * Row shapes are type aliases rather than interfaces so they satisfy the
 * Record<string, unknown> constraint used by @supabase/postgrest-js.
 */

export type AppointmentStatus =
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type ScheduleExceptionType = "CLOSED" | "MODIFIED_HOURS" | "EXTRA_HOURS";

export type AdminRole = "OWNER" | "RECEPTIONIST";

export type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Specialty = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Doctor = {
  id: string;
  clinic_id: string;
  specialty_id: string;
  full_name: string;
  photo_url: string | null;
  bio: string | null;
  qualifications: string | null;
  experience_years: number | null;
  consultation_fee: string;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WeeklySchedule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
};

export type ManualAvailability = {
  id: string;
  doctor_id: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type ScheduleException = {
  id: string;
  doctor_id: string;
  exception_date: string;
  exception_type: ScheduleExceptionType;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  reference_number: string;
  qr_token: string;
  doctor_id: string;
  clinic_id: string;
  patient_name: string;
  patient_phone: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
};

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  clinic_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: Clinic;
        Insert: {
          id?: string;
          name: string;
          address: string;
          phone: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Clinic>;
        Relationships: [];
      };
      specialties: {
        Row: Specialty;
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Specialty>;
        Relationships: [];
      };
      doctors: {
        Row: Doctor;
        Insert: {
          id?: string;
          clinic_id: string;
          specialty_id: string;
          full_name: string;
          photo_url?: string | null;
          bio?: string | null;
          qualifications?: string | null;
          experience_years?: number | null;
          consultation_fee: string;
          slot_duration_minutes: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Doctor>;
        Relationships: [];
      };
      weekly_schedules: {
        Row: WeeklySchedule;
        Insert: {
          id?: string;
          doctor_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<WeeklySchedule>;
        Relationships: [];
      };
      manual_availability: {
        Row: ManualAvailability;
        Insert: {
          id?: string;
          doctor_id: string;
          availability_date: string;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: Partial<ManualAvailability>;
        Relationships: [];
      };
      schedule_exceptions: {
        Row: ScheduleException;
        Insert: {
          id?: string;
          doctor_id: string;
          exception_date: string;
          exception_type: ScheduleExceptionType;
          start_time?: string | null;
          end_time?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<ScheduleException>;
        Relationships: [];
      };
      appointments: {
        Row: Appointment;
        Insert: {
          id?: string;
          reference_number?: string;
          qr_token?: string;
          doctor_id: string;
          clinic_id: string;
          patient_name: string;
          patient_phone: string;
          appointment_date: string;
          start_time: string;
          end_time: string;
          status?: AppointmentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Appointment>;
        Relationships: [];
      };
      admin_profiles: {
        Row: AdminProfile;
        Insert: {
          id: string;
          name: string;
          email: string;
          role: AdminRole;
          clinic_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AdminProfile>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_appointment: {
        Args: {
          p_doctor_id: string;
          p_date: string;
          p_start: string;
          p_patient_name: string;
          p_patient_phone: string;
        };
        Returns: Appointment;
      };
      reschedule_appointment: {
        Args: {
          p_appointment_id: string;
          p_date: string;
          p_start: string;
          p_reference_number: string;
          p_patient_phone: string;
        };
        Returns: Appointment;
      };
      cancel_appointment: {
        Args: {
          p_appointment_id: string;
          p_reference_number: string;
          p_patient_phone: string;
        };
        Returns: Appointment;
      };
      is_slot_available: {
        Args: {
          p_doctor_id: string;
          p_date: string;
          p_start: string;
          p_end: string;
          p_slot_duration_minutes?: number;
          p_ignore_appointment_id?: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables = Database["public"]["Tables"];
