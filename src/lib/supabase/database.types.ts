export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "organizer" | "participant" | "venue_admin" | "super_admin";
  onboarding_role: "student" | "teacher" | "staff" | "other" | null;
  organization: string;
  event_interest: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type EventRecord = {
  id: string;
  created_by: string;
  title: string;
  idea: string;
  description: string;
  event_date: string | null;
  format: string;
  guests_count: number | null;
  budget: number | null;
  venue_name: string;
  goal: string;
  target_audience: string;
  program: Json;
  risks: Json;
  status: "draft" | "planning" | "ready" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AIThread = {
  id: string;
  event_id: string | null;
  user_id: string;
  title: string;
  created_at: string;
};

export type AIMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  source_message_id: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};

export type EventTaskRecord = {
  id: string;
  event_id: string;
  created_by: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  created_at: string;
  updated_at: string;
};

export type EventEquipmentRecord = {
  id: string;
  event_id: string;
  created_by: string;
  name: string;
  quantity: number;
  notes: string;
  status: "needed" | "acquired" | "rented" | "not_needed";
  created_at: string;
  updated_at: string;
};

export type VenueRecord = {
  id: string;
  created_by: string;
  name: string;
  description: string;
  address: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueRoomRecord = {
  id: string;
  venue_id: string;
  name: string;
  capacity: number;
  hourly_rate: number | null;
  equipment: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type EventBookingRecord = {
  id: string;
  event_id: string;
  room_id: string;
  requested_by: string;
  event_title: string;
  guest_count: number | null;
  event_date: string | null;
  venue_name: string;
  room_name: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  organizer_note: string;
  admin_note: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      venues: {
        Row: VenueRecord;
        Insert: Omit<VenueRecord, "id" | "created_at" | "updated_at" | "active"> &
          Partial<Pick<VenueRecord, "id" | "created_at" | "updated_at" | "active">>;
        Update: Partial<Pick<VenueRecord, "name" | "description" | "address" | "active">>;
        Relationships: [];
      };
      venue_rooms: {
        Row: VenueRoomRecord;
        Insert: Omit<VenueRoomRecord, "id" | "created_at" | "updated_at" | "active" | "hourly_rate" | "equipment"> &
          Partial<Pick<VenueRoomRecord, "id" | "created_at" | "updated_at" | "active" | "hourly_rate" | "equipment">>;
        Update: Partial<Pick<VenueRoomRecord, "name" | "capacity" | "hourly_rate" | "equipment" | "active">>;
        Relationships: [];
      };
      event_bookings: {
        Row: EventBookingRecord;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      event_tasks: {
        Row: EventTaskRecord;
        Insert: Omit<EventTaskRecord, "id" | "created_at" | "updated_at" | "status"> &
          Partial<Pick<EventTaskRecord, "id" | "created_at" | "updated_at" | "status">>;
        Update: Partial<
          Pick<EventTaskRecord, "title" | "description" | "due_date" | "priority" | "status">
        >;
        Relationships: [];
      };
      event_equipment: {
        Row: EventEquipmentRecord;
        Insert: Omit<
          EventEquipmentRecord,
          "id" | "created_at" | "updated_at" | "status" | "quantity" | "notes"
        > &
          Partial<
            Pick<EventEquipmentRecord, "id" | "created_at" | "updated_at" | "status" | "quantity" | "notes">
          >;
        Update: Partial<Pick<EventEquipmentRecord, "name" | "quantity" | "notes" | "status">>;
        Relationships: [];
      };
      ai_threads: {
        Row: AIThread;
        Insert: Omit<AIThread, "id" | "created_at"> &
          Partial<Pick<AIThread, "id" | "created_at">>;
        Update: Partial<Pick<AIThread, "title">>;
        Relationships: [];
      };
      ai_messages: {
        Row: AIMessage;
        Insert: Omit<AIMessage, "id" | "created_at"> &
          Partial<Pick<AIMessage, "id" | "created_at">>;
        Update: never;
        Relationships: [];
      };
      ai_usage: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          thread_id: string | null;
          model: string;
          tokens_in: number;
          tokens_out: number;
          cost_estimate: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          thread_id?: string | null;
          model: string;
          tokens_in?: number;
          tokens_out?: number;
          cost_estimate?: number | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      events: {
        Row: EventRecord;
        Insert: Omit<
          EventRecord,
          | "id"
          | "created_at"
          | "updated_at"
          | "status"
          | "goal"
          | "target_audience"
          | "program"
          | "risks"
        > &
          Partial<
            Pick<
              EventRecord,
              "id" | "created_at" | "updated_at" | "status" | "goal" | "target_audience" | "program" | "risks"
            >
          >;
        Update: Partial<
          Omit<EventRecord, "id" | "created_by" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
      event_members: {
        Row: {
          event_id: string;
          user_id: string;
          role: "organizer" | "participant";
          invited_by: string | null;
          joined_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          role?: "organizer" | "participant";
          invited_by?: string | null;
          joined_at?: string;
        };
        Update: Partial<{
          role: "organizer" | "participant";
          invited_by: string | null;
          joined_at: string;
        }>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> &
          Partial<Pick<Profile, "created_at" | "updated_at">>;
        Update: Partial<
          Omit<Profile, "id" | "role" | "created_at" | "updated_at">
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      book_event_room: {
        Args: {
          target_event_id: string;
          target_room_id: string;
          target_starts_at: string;
          target_ends_at: string;
          target_organizer_note?: string;
        };
        Returns: string;
      };
      cancel_event_booking: {
        Args: { target_booking_id: string };
        Returns: undefined;
      };
      consume_ai_rate_limit: {
        Args: { maximum_requests: number; window_seconds: number };
        Returns: boolean;
      };
      has_venue_admin_role: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_venue_owner: {
        Args: { target_venue_id: string };
        Returns: boolean;
      };
      review_event_booking: {
        Args: {
          target_booking_id: string;
          decision: string;
          response_note?: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
