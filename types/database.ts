export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      notebooks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          area: string | null;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          area?: string | null;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          area?: string | null;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_reminders: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          remind_at: string;
          dismissed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          user_id: string;
          remind_at: string;
          dismissed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          user_id?: string;
          remind_at?: string;
          dismissed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          notebook_id: string | null;
          project_id: string | null;
          title: string;
          content: Json;
          tags: string[];
          pinned: boolean;
          deleted_at: string | null;
          color: string | null;
          emoji: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notebook_id?: string | null;
          project_id?: string | null;
          title?: string;
          content?: Json;
          tags?: string[];
          pinned?: boolean;
          deleted_at?: string | null;
          color?: string | null;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notebook_id?: string | null;
          project_id?: string | null;
          title?: string;
          content?: Json;
          tags?: string[];
          pinned?: boolean;
          deleted_at?: string | null;
          color?: string | null;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          content: Json;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          content?: Json;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          content?: Json;
          tags?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "checking" | "savings" | "investment" | "other";
          currency: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "checking" | "savings" | "investment" | "other";
          currency?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "checking" | "savings" | "investment" | "other";
          currency?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      balance_snapshots: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          balance: number;
          snapshot_month: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          balance: number;
          snapshot_month: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          balance?: number;
          snapshot_month?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      recurring_expenses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          currency: string;
          frequency: "monthly" | "quarterly" | "annual";
          category: string;
          next_due_date: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          amount: number;
          currency?: string;
          frequency: "monthly" | "quarterly" | "annual";
          category: string;
          next_due_date: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          amount?: number;
          currency?: string;
          frequency?: "monthly" | "quarterly" | "annual";
          category?: string;
          next_due_date?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      financial_commitments: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "mortgage" | "loan" | "lease" | "other";
          original_amount: number;
          remaining_amount: number;
          monthly_payment: number;
          interest_rate: number | null;
          end_date: string | null;
          currency: string;
          is_active: boolean;
          goal_type: "debt" | "savings";
          target_amount: number | null;
          current_saved: number;
          total_installments: number | null;
          paid_installments: number;
          due_day: number | null;
          last_auto_paid_month: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "mortgage" | "loan" | "lease" | "other";
          original_amount: number;
          remaining_amount: number;
          monthly_payment: number;
          interest_rate?: number | null;
          end_date?: string | null;
          currency?: string;
          is_active?: boolean;
          goal_type?: "debt" | "savings";
          target_amount?: number | null;
          current_saved?: number;
          total_installments?: number | null;
          paid_installments?: number;
          due_day?: number | null;
          last_auto_paid_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "mortgage" | "loan" | "lease" | "other";
          original_amount?: number;
          remaining_amount?: number;
          monthly_payment?: number;
          interest_rate?: number | null;
          end_date?: string | null;
          currency?: string;
          is_active?: boolean;
          goal_type?: "debt" | "savings";
          target_amount?: number | null;
          current_saved?: number;
          total_installments?: number | null;
          paid_installments?: number;
          due_day?: number | null;
          last_auto_paid_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monthly_income: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          budget_month: string | null;
          label: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          budget_month?: string | null;
          label?: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          budget_month?: string | null;
          label?: string;
          amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      monthly_notes: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      budget_cycles: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          planned_savings: number;
          planned_variable_spending: number;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          planned_savings?: number;
          planned_variable_spending?: number;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          planned_savings?: number;
          planned_variable_spending?: number;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      investment_instruments: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          exchange: string | null;
          isin: string | null;
          name: string;
          currency: string;
          provider: string;
          provider_symbol: string;
          last_price: number | null;
          last_price_at: string | null;
          last_price_source: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          exchange?: string | null;
          isin?: string | null;
          name: string;
          currency?: string;
          provider?: string;
          provider_symbol: string;
          last_price?: number | null;
          last_price_at?: string | null;
          last_price_source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          exchange?: string | null;
          isin?: string | null;
          name?: string;
          currency?: string;
          provider?: string;
          provider_symbol?: string;
          last_price?: number | null;
          last_price_at?: string | null;
          last_price_source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      investment_prices: {
        Row: {
          id: string;
          user_id: string;
          instrument_id: string;
          price: number;
          currency: string;
          priced_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          instrument_id: string;
          price: number;
          currency?: string;
          priced_at: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          instrument_id?: string;
          price?: number;
          currency?: string;
          priced_at?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      investment_recurring_plans: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          instrument_id: string;
          name: string;
          day_of_month: number;
          amount: number;
          currency: string;
          is_active: boolean;
          start_month: string;
          last_executed_month: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          instrument_id: string;
          name: string;
          day_of_month: number;
          amount: number;
          currency?: string;
          is_active?: boolean;
          start_month: string;
          last_executed_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          instrument_id?: string;
          name?: string;
          day_of_month?: number;
          amount?: number;
          currency?: string;
          is_active?: boolean;
          start_month?: string;
          last_executed_month?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      investment_transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          instrument_id: string;
          recurring_plan_id: string | null;
          type: "buy" | "sell";
          trade_date: string;
          shares: number;
          price: number;
          fees: number;
          currency: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          instrument_id: string;
          recurring_plan_id?: string | null;
          type: "buy" | "sell";
          trade_date: string;
          shares: number;
          price: number;
          fees?: number;
          currency?: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          instrument_id?: string;
          recurring_plan_id?: string | null;
          type?: "buy" | "sell";
          trade_date?: string;
          shares?: number;
          price?: number;
          fees?: number;
          currency?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          area: string;
          horizon: "month" | "quarter" | "year" | "life";
          status: "active" | "paused" | "completed" | "archived";
          target_value: number | null;
          current_value: number;
          unit: string | null;
          due_date: string | null;
          linked_project_id: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          area?: string;
          horizon?: "month" | "quarter" | "year" | "life";
          status?: "active" | "paused" | "completed" | "archived";
          target_value?: number | null;
          current_value?: number;
          unit?: string | null;
          due_date?: string | null;
          linked_project_id?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          area?: string;
          horizon?: "month" | "quarter" | "year" | "life";
          status?: "active" | "paused" | "completed" | "archived";
          target_value?: number | null;
          current_value?: number;
          unit?: string | null;
          due_date?: string | null;
          linked_project_id?: string | null;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      automation_rules: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          trigger_type: string;
          condition_config: Json;
          action_type: string;
          action_config: Json;
          is_active: boolean;
          last_run_at: string | null;
          run_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          trigger_type?: string;
          condition_config?: Json;
          action_type?: string;
          action_config?: Json;
          is_active?: boolean;
          last_run_at?: string | null;
          run_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          trigger_type?: string;
          condition_config?: Json;
          action_type?: string;
          action_config?: Json;
          is_active?: boolean;
          last_run_at?: string | null;
          run_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shared_notes: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          token: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          user_id: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          user_id?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          emoji: string | null;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          emoji?: string | null;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          emoji?: string | null;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          note_id: string | null;
          title: string;
          description: string;
          status: "todo" | "in_progress" | "done";
          priority: "urgent" | "high" | "medium" | "low";
          due_date: string | null;
          tags: string[];
          sort_order: number;
          recurring: "daily" | "weekly" | "monthly" | null;
          completed_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          note_id?: string | null;
          title?: string;
          description?: string;
          status?: "todo" | "in_progress" | "done";
          priority?: "urgent" | "high" | "medium" | "low";
          due_date?: string | null;
          tags?: string[];
          sort_order?: number;
          recurring?: "daily" | "weekly" | "monthly" | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          note_id?: string | null;
          title?: string;
          description?: string;
          status?: "todo" | "in_progress" | "done";
          priority?: "urgent" | "high" | "medium" | "low";
          due_date?: string | null;
          tags?: string[];
          sort_order?: number;
          recurring?: "daily" | "weekly" | "monthly" | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subtasks: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          completed: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          title?: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          title?: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          emoji: string | null;
          color: string;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          emoji?: string | null;
          color?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          emoji?: string | null;
          color?: string;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      habit_entries: {
        Row: {
          id: string;
          habit_id: string;
          user_id: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          habit_id: string;
          user_id: string;
          date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          habit_id?: string;
          user_id?: string;
          date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          type: string;
          distance_km: number | null;
          duration_minutes: number | null;
          avg_pace: string | null;
          best_pace: string | null;
          calories: number | null;
          avg_heart_rate: number | null;
          max_heart_rate: number | null;
          avg_cadence: number | null;
          elevation_m: number | null;
          steps: number | null;
          feeling: number | null;
          notes: string | null;
          intervals: Json | null;
          training_effect_aerobic: number | null;
          training_effect_anaerobic: number | null;
          source: string;
          ai_feedback: string | null;
          ai_feedback_generated_at: string | null;
          hr_zones: Json | null;
          max_cadence: number | null;
          avg_stride_cm: number | null;
          max_stride_cm: number | null;
          vo2_max: number | null;
          recovery_hours: number | null;
          source_id: string | null;
          source_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          type?: string;
          distance_km?: number | null;
          duration_minutes?: number | null;
          avg_pace?: string | null;
          best_pace?: string | null;
          calories?: number | null;
          avg_heart_rate?: number | null;
          max_heart_rate?: number | null;
          avg_cadence?: number | null;
          elevation_m?: number | null;
          steps?: number | null;
          feeling?: number | null;
          notes?: string | null;
          intervals?: Json | null;
          training_effect_aerobic?: number | null;
          training_effect_anaerobic?: number | null;
          source?: string;
          ai_feedback?: string | null;
          ai_feedback_generated_at?: string | null;
          hr_zones?: Json | null;
          max_cadence?: number | null;
          avg_stride_cm?: number | null;
          max_stride_cm?: number | null;
          vo2_max?: number | null;
          recovery_hours?: number | null;
          source_id?: string | null;
          source_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          type?: string;
          distance_km?: number | null;
          duration_minutes?: number | null;
          avg_pace?: string | null;
          best_pace?: string | null;
          calories?: number | null;
          avg_heart_rate?: number | null;
          max_heart_rate?: number | null;
          avg_cadence?: number | null;
          elevation_m?: number | null;
          steps?: number | null;
          feeling?: number | null;
          notes?: string | null;
          intervals?: Json | null;
          training_effect_aerobic?: number | null;
          training_effect_anaerobic?: number | null;
          source?: string;
          ai_feedback?: string | null;
          ai_feedback_generated_at?: string | null;
          hr_zones?: Json | null;
          max_cadence?: number | null;
          avg_stride_cm?: number | null;
          max_stride_cm?: number | null;
          vo2_max?: number | null;
          recovery_hours?: number | null;
          source_id?: string | null;
          source_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      strava_connections: {
        Row: {
          user_id: string;
          athlete_id: number;
          athlete_firstname: string | null;
          athlete_lastname: string | null;
          access_token_enc: string;
          refresh_token_enc: string;
          expires_at: string;
          scope: string | null;
          last_sync_at: string | null;
          last_sync_count: number | null;
          last_sync_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          athlete_id: number;
          athlete_firstname?: string | null;
          athlete_lastname?: string | null;
          access_token_enc: string;
          refresh_token_enc: string;
          expires_at: string;
          scope?: string | null;
          last_sync_at?: string | null;
          last_sync_count?: number | null;
          last_sync_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          athlete_id?: number;
          athlete_firstname?: string | null;
          athlete_lastname?: string | null;
          access_token_enc?: string;
          refresh_token_enc?: string;
          expires_at?: string;
          scope?: string | null;
          last_sync_at?: string | null;
          last_sync_count?: number | null;
          last_sync_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      body_metrics: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight_kg: number | null;
          body_fat_pct: number | null;
          waist_cm: number | null;
          resting_hr: number | null;
          height_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          waist_cm?: number | null;
          resting_hr?: number | null;
          height_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          waist_cm?: number | null;
          resting_hr?: number | null;
          height_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      fitness_coach_preferences: {
        Row: {
          user_id: string;
          goal: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          goal?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          goal?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      training_plans: {
        Row: {
          id: string;
          user_id: string;
          goal: string | null;
          notes: string | null;
          plan: string;
          week_start: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal?: string | null;
          notes?: string | null;
          plan: string;
          week_start: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal?: string | null;
          notes?: string | null;
          plan?: string;
          week_start?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      planned_workouts: {
        Row: {
          id: string;
          plan_id: string;
          user_id: string;
          day_label: string;
          workout_type: string;
          title: string;
          description: string | null;
          distance_km: number | null;
          duration_minutes: number | null;
          pace_target: string | null;
          actual_workout_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          user_id: string;
          day_label: string;
          workout_type?: string;
          title: string;
          description?: string | null;
          distance_km?: number | null;
          duration_minutes?: number | null;
          pace_target?: string | null;
          actual_workout_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          user_id?: string;
          day_label?: string;
          workout_type?: string;
          title?: string;
          description?: string | null;
          distance_km?: number | null;
          duration_minutes?: number | null;
          pace_target?: string | null;
          actual_workout_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      university_settings: {
        Row: {
          user_id: string;
          student_name: string | null;
          student_number: string | null;
          degree_course: string | null;
          total_cfu: number;
          bonus_points: number;
          honors_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          student_name?: string | null;
          student_number?: string | null;
          degree_course?: string | null;
          total_cfu?: number;
          bonus_points?: number;
          honors_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          student_name?: string | null;
          student_number?: string | null;
          degree_course?: string | null;
          total_cfu?: number;
          bonus_points?: number;
          honors_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      university_exams: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cfu: number;
          grade: number | null;
          honors: boolean;
          status: "planned" | "booked" | "online" | "recognized";
          exam_type: "mandatory" | "elective";
          year: number;
          area: string | null;
          exam_date: string | null;
          counts_avg: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cfu: number;
          grade?: number | null;
          honors?: boolean;
          status?: "planned" | "booked" | "online" | "recognized";
          exam_type?: "mandatory" | "elective";
          year?: number;
          area?: string | null;
          exam_date?: string | null;
          counts_avg?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cfu?: number;
          grade?: number | null;
          honors?: boolean;
          status?: "planned" | "booked" | "online" | "recognized";
          exam_type?: "mandatory" | "elective";
          year?: number;
          area?: string | null;
          exam_date?: string | null;
          counts_avg?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      note_versions: {
        Row: {
          id: string;
          note_id: string;
          user_id: string;
          title: string;
          content: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id: string;
          user_id: string;
          title: string;
          content: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string;
          user_id?: string;
          title?: string;
          content?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
