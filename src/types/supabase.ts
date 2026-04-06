// ─── Auto-generated from Supabase schema ───────────────────────────────────
// Phase 3.1: Types generated via
//   mcp__supabase__generate_typescript_types (project: rmvodrpgaffxeultskst)
//
// DO NOT EDIT BY HAND. To regenerate after a schema change, run the MCP
// tool again and replace the contents of this file.
//
// Usage:
//   import type { Database, Tables, TablesInsert, Enums } from "@/types/supabase";
//   type Task = Tables<"tasks">;
//   type NewTask = TablesInsert<"tasks">;
//   type Engine = Enums<"engine_key">; // "body" | "mind" | "money" | "charisma"
//
// The supabase-js client is typed against this Database type in
// src/lib/supabase.ts (Phase 3.2).
// ───────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements_unlocked: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_unlocked_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boss_challenges: {
        Row: {
          boss_id: string
          day_results: Json
          days_required: number
          evaluator_type: string
          id: string
          progress: number
          resolved_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["boss_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          boss_id: string
          day_results?: Json
          days_required: number
          evaluator_type: string
          id?: string
          progress?: number
          resolved_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["boss_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          boss_id?: string
          day_results?: Json
          days_required?: number
          evaluator_type?: string
          id?: string
          progress?: number
          resolved_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["boss_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boss_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          monthly_limit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      completions: {
        Row: {
          created_at: string
          date_key: string
          engine: Database["public"]["Enums"]["engine_key"]
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          engine: Database["public"]["Enums"]["engine_key"]
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_key?: string
          engine?: Database["public"]["Enums"]["engine_key"]
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_work_sessions: {
        Row: {
          category: string | null
          date_key: string
          ended_at: string | null
          id: string
          minutes: number
          notes: string | null
          started_at: string
          task_name: string
          user_id: string
        }
        Insert: {
          category?: string | null
          date_key: string
          ended_at?: string | null
          id?: string
          minutes: number
          notes?: string | null
          started_at?: string
          task_name: string
          user_id: string
        }
        Update: {
          category?: string | null
          date_key?: string
          ended_at?: string | null
          id?: string
          minutes?: number
          notes?: string | null
          started_at?: string
          task_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deep_work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_exercises: {
        Row: {
          created_at: string
          equipment: string | null
          id: string
          is_custom: boolean
          muscle_group: string | null
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment?: string | null
          id?: string
          is_custom?: boolean
          muscle_group?: string | null
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          equipment?: string | null
          id?: string
          is_custom?: boolean
          muscle_group?: string | null
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_personal_records: {
        Row: {
          achieved_at: string
          exercise_name: string
          id: string
          reps: number
          user_id: string
          weight: number
        }
        Insert: {
          achieved_at?: string
          exercise_name: string
          id?: string
          reps: number
          user_id: string
          weight: number
        }
        Update: {
          achieved_at?: string
          exercise_name?: string
          id?: string
          reps?: number
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_personal_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_sessions: {
        Row: {
          date_key: string
          ended_at: string | null
          id: string
          name: string | null
          notes: string | null
          started_at: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          date_key: string
          ended_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          started_at?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          date_key?: string
          ended_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          started_at?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "gym_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_sets: {
        Row: {
          created_at: string
          exercise_id: string | null
          exercise_name: string
          id: string
          notes: string | null
          reps: number | null
          rpe: number | null
          session_id: string
          set_index: number
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          exercise_id?: string | null
          exercise_name: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_index: number
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          exercise_id?: string | null
          exercise_name?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_index?: number
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "gym_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gym_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_sets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_templates: {
        Row: {
          created_at: string
          description: string | null
          exercise_ids: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exercise_ids?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exercise_ids?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          created_at: string
          date_key: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_key?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          best_chain: number
          created_at: string
          current_chain: number
          duration_text: string | null
          engine: string
          frequency: string | null
          icon: string
          id: string
          last_broken_date: string | null
          title: string
          trigger_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_chain?: number
          created_at?: string
          current_chain?: number
          duration_text?: string | null
          engine: string
          frequency?: string | null
          icon?: string
          id?: string
          last_broken_date?: string | null
          title: string
          trigger_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_chain?: number
          created_at?: string
          current_chain?: number
          duration_text?: string | null
          engine?: string
          frequency?: string | null
          icon?: string
          id?: string
          last_broken_date?: string | null
          title?: string
          trigger_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          content: string
          created_at: string
          date_key: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          date_key: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date_key?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_logs: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          date_key: string
          fat_g: number
          id: string
          name: string
          protein_g: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string
          date_key: string
          fat_g?: number
          id?: string
          name: string
          protein_g?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          date_key?: string
          fat_g?: number
          id?: string
          name?: string
          protein_g?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      money_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date_key: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date_key: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date_key?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      narrative_entries: {
        Row: {
          flag: string
          id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          flag: string
          id?: string
          seen_at?: string
          user_id: string
        }
        Update: {
          flag?: string
          id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "narrative_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_profile: {
        Row: {
          age: number | null
          bmr: number | null
          body_fat_pct: number | null
          carbs_target_g: number | null
          daily_calorie_target: number | null
          fat_target_g: number | null
          goal: string | null
          goal_rate: string | null
          height_cm: number | null
          protein_preference: string | null
          protein_target_g: number | null
          sex: string | null
          steps_per_day: number | null
          tdee: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
          workouts_per_week: number | null
        }
        Insert: {
          age?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          carbs_target_g?: number | null
          daily_calorie_target?: number | null
          fat_target_g?: number | null
          goal?: string | null
          goal_rate?: string | null
          height_cm?: number | null
          protein_preference?: string | null
          protein_target_g?: number | null
          sex?: string | null
          steps_per_day?: number | null
          tdee?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
          workouts_per_week?: number | null
        }
        Update: {
          age?: number | null
          bmr?: number | null
          body_fat_pct?: number | null
          carbs_target_g?: number | null
          daily_calorie_target?: number | null
          fat_target_g?: number | null
          goal?: string | null
          goal_rate?: string | null
          height_cm?: number | null
          protein_preference?: string | null
          protein_target_g?: number | null
          sex?: string | null
          steps_per_day?: number | null
          tdee?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
          workouts_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archetype: Database["public"]["Enums"]["archetype"] | null
          created_at: string
          display_name: string | null
          email: string | null
          first_task_completed_at: string | null
          first_use_date: string | null
          focus_engines: Database["public"]["Enums"]["engine_key"][]
          id: string
          level: number
          mode: Database["public"]["Enums"]["app_mode"]
          onboarding_completed: boolean
          streak_best: number
          streak_current: number
          streak_last_date: string | null
          tutorial_completed: boolean
          updated_at: string
          xp: number
        }
        Insert: {
          archetype?: Database["public"]["Enums"]["archetype"] | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_task_completed_at?: string | null
          first_use_date?: string | null
          focus_engines?: Database["public"]["Enums"]["engine_key"][]
          id: string
          level?: number
          mode?: Database["public"]["Enums"]["app_mode"]
          onboarding_completed?: boolean
          streak_best?: number
          streak_current?: number
          streak_last_date?: string | null
          tutorial_completed?: boolean
          updated_at?: string
          xp?: number
        }
        Update: {
          archetype?: Database["public"]["Enums"]["archetype"] | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_task_completed_at?: string | null
          first_use_date?: string | null
          focus_engines?: Database["public"]["Enums"]["engine_key"][]
          id?: string
          level?: number
          mode?: Database["public"]["Enums"]["app_mode"]
          onboarding_completed?: boolean
          streak_best?: number
          streak_current?: number
          streak_last_date?: string | null
          tutorial_completed?: boolean
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      progression: {
        Row: {
          current_phase: Database["public"]["Enums"]["progression_phase"]
          current_week: number
          first_use_date: string | null
          phase_history: Json
          phase_start_date: string | null
          phase_start_week: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_phase?: Database["public"]["Enums"]["progression_phase"]
          current_week?: number
          first_use_date?: string | null
          phase_history?: Json
          phase_start_date?: string | null
          phase_start_week?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_phase?: Database["public"]["Enums"]["progression_phase"]
          current_week?: number
          first_use_date?: string | null
          phase_history?: Json
          phase_start_date?: string | null
          phase_start_week?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progression_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_sessions: {
        Row: {
          created_at: string
          date_key: string
          evening_completed_at: string | null
          evening_reflection: string | null
          habit_checks: Json
          id: string
          identity_at_completion:
            | Database["public"]["Enums"]["archetype"]
            | null
          morning_completed_at: string | null
          morning_intention: string | null
          titan_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          evening_completed_at?: string | null
          evening_reflection?: string | null
          habit_checks?: Json
          id?: string
          identity_at_completion?:
            | Database["public"]["Enums"]["archetype"]
            | null
          morning_completed_at?: string | null
          morning_intention?: string | null
          titan_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_key?: string
          evening_completed_at?: string | null
          evening_reflection?: string | null
          habit_checks?: Json
          id?: string
          identity_at_completion?:
            | Database["public"]["Enums"]["archetype"]
            | null
          morning_completed_at?: string | null
          morning_intention?: string | null
          titan_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          created_at: string
          description: string
          expires_at: string | null
          id: string
          metadata: Json
          progress: number
          status: Database["public"]["Enums"]["quest_status"]
          target: number
          title: string
          type: string
          updated_at: string
          user_id: string
          week_start_key: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          progress?: number
          status?: Database["public"]["Enums"]["quest_status"]
          target?: number
          title: string
          type: string
          updated_at?: string
          user_id: string
          week_start_key: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          progress?: number
          status?: Database["public"]["Enums"]["quest_status"]
          target?: number
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          week_start_key?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "quests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_up_events: {
        Row: {
          created_at: string
          dismissed_at: string | null
          from_level: number
          id: string
          to_level: number
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          from_level: number
          id?: string
          to_level: number
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          from_level?: number
          id?: string
          to_level?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_up_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_tree_progress: {
        Row: {
          claimed_at: string | null
          engine: Database["public"]["Enums"]["engine_key"]
          id: string
          node_id: string
          progress: number
          state: Database["public"]["Enums"]["skill_node_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          engine: Database["public"]["Enums"]["engine_key"]
          id?: string
          node_id: string
          progress?: number
          state?: Database["public"]["Enums"]["skill_node_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          engine?: Database["public"]["Enums"]["engine_key"]
          id?: string
          node_id?: string
          progress?: number
          state?: Database["public"]["Enums"]["skill_node_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_tree_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          created_at: string
          date_key: string
          hours_slept: number | null
          id: string
          notes: string | null
          quality: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date_key: string
          hours_slept?: number | null
          id?: string
          notes?: string | null
          quality?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date_key?: string
          hours_slept?: number | null
          id?: string
          notes?: string | null
          quality?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleep_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_reason: string | null
          created_at: string
          entitlement_id: string | null
          expires_at: string | null
          last_event_at: string | null
          last_event_type: string | null
          original_purchase_date: string | null
          period_type: string | null
          product_id: string | null
          purchase_date: string | null
          raw_event: Json | null
          renewed_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          store: string | null
          updated_at: string
          user_id: string
          will_renew: boolean
        }
        Insert: {
          cancel_reason?: string | null
          created_at?: string
          entitlement_id?: string | null
          expires_at?: string | null
          last_event_at?: string | null
          last_event_type?: string | null
          original_purchase_date?: string | null
          period_type?: string | null
          product_id?: string | null
          purchase_date?: string | null
          raw_event?: Json | null
          renewed_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: string | null
          updated_at?: string
          user_id: string
          will_renew?: boolean
        }
        Update: {
          cancel_reason?: string | null
          created_at?: string
          entitlement_id?: string | null
          expires_at?: string | null
          last_event_at?: string | null
          last_event_type?: string | null
          original_purchase_date?: string | null
          period_type?: string | null
          product_id?: string | null
          purchase_date?: string | null
          raw_event?: Json | null
          renewed_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: string | null
          updated_at?: string
          user_id?: string
          will_renew?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          days_per_week: number
          engine: Database["public"]["Enums"]["engine_key"]
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["task_kind"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_per_week?: number
          engine: Database["public"]["Enums"]["engine_key"]
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["task_kind"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_per_week?: number
          engine?: Database["public"]["Enums"]["engine_key"]
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["task_kind"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          created_at: string
          date_key: string
          id: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date_key: string
          id?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date_key?: string
          id?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_mode:
        | "full_protocol"
        | "structured"
        | "tracker"
        | "focus"
        | "zen"
        | "titan"
      archetype:
        | "titan"
        | "athlete"
        | "scholar"
        | "hustler"
        | "showman"
        | "warrior"
        | "founder"
        | "charmer"
      boss_status: "active" | "defeated" | "failed" | "abandoned"
      engine_key: "body" | "mind" | "money" | "charisma"
      progression_phase: "foundation" | "building" | "intensify" | "sustain"
      quest_status: "active" | "completed" | "failed"
      skill_node_state: "locked" | "ready" | "claimed"
      subscription_status:
        | "none"
        | "trial"
        | "active"
        | "grace"
        | "expired"
        | "cancelled"
        | "refunded"
      task_kind: "main" | "secondary"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_mode: [
        "full_protocol",
        "structured",
        "tracker",
        "focus",
        "zen",
        "titan",
      ],
      archetype: [
        "titan",
        "athlete",
        "scholar",
        "hustler",
        "showman",
        "warrior",
        "founder",
        "charmer",
      ],
      boss_status: ["active", "defeated", "failed", "abandoned"],
      engine_key: ["body", "mind", "money", "charisma"],
      progression_phase: ["foundation", "building", "intensify", "sustain"],
      quest_status: ["active", "completed", "failed"],
      skill_node_state: ["locked", "ready", "claimed"],
      subscription_status: [
        "none",
        "trial",
        "active",
        "grace",
        "expired",
        "cancelled",
        "refunded",
      ],
      task_kind: ["main", "secondary"],
    },
  },
} as const
