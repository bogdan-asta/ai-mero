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

export type Database = {
  public: {
    Tables: {
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
      consume_ai_rate_limit: {
        Args: { maximum_requests: number; window_seconds: number };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
