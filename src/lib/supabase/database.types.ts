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
  status: "draft" | "planning" | "ready" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRecord;
        Insert: Omit<EventRecord, "id" | "created_at" | "updated_at" | "status"> &
          Partial<Pick<EventRecord, "id" | "created_at" | "updated_at" | "status">>;
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
