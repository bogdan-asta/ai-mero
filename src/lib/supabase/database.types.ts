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

export type Database = {
  public: {
    Tables: {
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
