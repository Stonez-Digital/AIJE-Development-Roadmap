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
      alert_deliveries: {
        Row: {
          alert_id: string
          attempts: number
          channel: string
          created_at: string
          error: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          recipient: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          attempts?: number
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          status?: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "community_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_escalations: {
        Row: {
          alert_id: string
          created_at: string
          from_level: number
          id: string
          notified_contacts: string[]
          reason: string | null
          to_level: number
        }
        Insert: {
          alert_id: string
          created_at?: string
          from_level: number
          id?: string
          notified_contacts?: string[]
          reason?: string | null
          to_level: number
        }
        Update: {
          alert_id?: string
          created_at?: string
          from_level?: number
          id?: string
          notified_contacts?: string[]
          reason?: string | null
          to_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "alert_escalations_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "community_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_history: {
        Row: {
          created_at: string
          id: string
          message: string
          sensor_type: string
          severity: string
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sensor_type: string
          severity?: string
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sensor_type?: string
          severity?: string
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      camera_media: {
        Row: {
          camera_name: string
          created_at: string
          duration: number | null
          file_path: string
          file_size: number | null
          id: string
          media_type: string
          user_id: string
        }
        Insert: {
          camera_name: string
          created_at?: string
          duration?: number | null
          file_path: string
          file_size?: number | null
          id?: string
          media_type: string
          user_id: string
        }
        Update: {
          camera_name?: string
          created_at?: string
          duration?: number | null
          file_path?: string
          file_size?: number | null
          id?: string
          media_type?: string
          user_id?: string
        }
        Relationships: []
      }
      cameras: {
        Row: {
          auto_snapshot_interval_sec: number | null
          created_at: string
          enabled: boolean
          id: string
          name: string
          stream_type: string
          stream_url: string
          updated_at: string
          user_id: string
          zone_alert_severity: string | null
          zone_cooldown_sec: number | null
        }
        Insert: {
          auto_snapshot_interval_sec?: number | null
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          stream_type?: string
          stream_url: string
          updated_at?: string
          user_id: string
          zone_alert_severity?: string | null
          zone_cooldown_sec?: number | null
        }
        Update: {
          auto_snapshot_interval_sec?: number | null
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          stream_type?: string
          stream_url?: string
          updated_at?: string
          user_id?: string
          zone_alert_severity?: string | null
          zone_cooldown_sec?: number | null
        }
        Relationships: []
      }
      community_alert_targets: {
        Row: {
          alert_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_alert_targets_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "community_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_alert_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_watch_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_alerts: {
        Row: {
          created_at: string
          escalation_level: number
          id: string
          incident_id: string | null
          incident_type: string
          instructions: string
          language: string
          location: string
          next_escalation_at: string | null
          occurred_at: string
          owner_id: string
          resolved_at: string | null
          status: string
          summary: string
          threat_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalation_level?: number
          id?: string
          incident_id?: string | null
          incident_type: string
          instructions?: string
          language?: string
          location: string
          next_escalation_at?: string | null
          occurred_at?: string
          owner_id: string
          resolved_at?: string | null
          status?: string
          summary: string
          threat_level?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalation_level?: number
          id?: string
          incident_id?: string | null
          incident_type?: string
          instructions?: string
          language?: string
          location?: string
          next_escalation_at?: string | null
          occurred_at?: string
          owner_id?: string
          resolved_at?: string | null
          status?: string
          summary?: string
          threat_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          phone: string
          preferred_language: string
          sms_enabled: boolean
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_target: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          phone: string
          preferred_language?: string
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_target?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          phone?: string
          preferred_language?: string
          sms_enabled?: boolean
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_watch_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_watch_groups: {
        Row: {
          community: string
          created_at: string
          escalation_minutes: number
          id: string
          leader_name: string | null
          name: string
          owner_id: string
          updated_at: string
          ward: string | null
        }
        Insert: {
          community: string
          created_at?: string
          escalation_minutes?: number
          id?: string
          leader_name?: string | null
          name: string
          owner_id: string
          updated_at?: string
          ward?: string | null
        }
        Update: {
          community?: string
          created_at?: string
          escalation_minutes?: number
          id?: string
          leader_name?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
          ward?: string | null
        }
        Relationships: []
      }
      deployments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          status: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          status?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          status?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          active: boolean
          authority_level: number
          category: string
          community: string | null
          created_at: string
          id: string
          incident_types: string[]
          name: string
          owner_id: string
          phone: string
          updated_at: string
          whatsapp_target: string | null
        }
        Insert: {
          active?: boolean
          authority_level?: number
          category: string
          community?: string | null
          created_at?: string
          id?: string
          incident_types?: string[]
          name: string
          owner_id: string
          phone: string
          updated_at?: string
          whatsapp_target?: string | null
        }
        Update: {
          active?: boolean
          authority_level?: number
          category?: string
          community?: string | null
          created_at?: string
          id?: string
          incident_types?: string[]
          name?: string
          owner_id?: string
          phone?: string
          updated_at?: string
          whatsapp_target?: string | null
        }
        Relationships: []
      }
      face_consent: {
        Row: {
          accepted: boolean
          accepted_at: string | null
          created_at: string
          id: string
          legal_basis: string | null
          region: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
          id?: string
          legal_basis?: string | null
          region?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
          id?: string
          legal_basis?: string | null
          region?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      face_enrollments: {
        Row: {
          consent_subject_acknowledged: boolean
          created_at: string
          descriptor: number[]
          id: string
          label: string
          notes: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_subject_acknowledged?: boolean
          created_at?: string
          descriptor: number[]
          id?: string
          label: string
          notes?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_subject_acknowledged?: boolean
          created_at?: string
          descriptor?: number[]
          id?: string
          label?: string
          notes?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      face_privacy_settings: {
        Row: {
          audit_retention_days: number
          created_at: string
          embedding_retention_days: number
          fr_enabled: boolean
          id: string
          log_unknowns: boolean
          match_threshold: number
          suppress_alerts_for_trusted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_retention_days?: number
          created_at?: string
          embedding_retention_days?: number
          fr_enabled?: boolean
          id?: string
          log_unknowns?: boolean
          match_threshold?: number
          suppress_alerts_for_trusted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_retention_days?: number
          created_at?: string
          embedding_retention_days?: number
          fr_enabled?: boolean
          id?: string
          log_unknowns?: boolean
          match_threshold?: number
          suppress_alerts_for_trusted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      face_recognition_audit: {
        Row: {
          camera_name: string | null
          confidence: number | null
          created_at: string
          id: string
          match_enrollment_id: string | null
          match_label: string | null
          outcome: string
          user_id: string
        }
        Insert: {
          camera_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          match_enrollment_id?: string | null
          match_label?: string | null
          outcome: string
          user_id: string
        }
        Update: {
          camera_name?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          match_enrollment_id?: string | null
          match_label?: string | null
          outcome?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_audit_log: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_display_name: string | null
          correlation_id: string
          created_at: string
          from_status: string | null
          id: string
          incident_id: string
          incident_report_id: string | null
          metadata: Json
          new_status: string
          note: string | null
          organization_id: string | null
          previous_status: string | null
          reason: string | null
          to_status: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_display_name?: string | null
          correlation_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          incident_id: string
          incident_report_id?: string | null
          metadata?: Json
          new_status: string
          note?: string | null
          organization_id?: string | null
          previous_status?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_display_name?: string | null
          correlation_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          incident_id?: string
          incident_report_id?: string | null
          metadata?: Json
          new_status?: string
          note?: string | null
          organization_id?: string | null
          previous_status?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: { created_at: string; id: string; name: string; organization_id: string; team_type: string }
        Insert: { created_at?: string; id?: string; name: string; organization_id: string; team_type?: string }
        Update: { created_at?: string; id?: string; name?: string; organization_id?: string; team_type?: string }
        Relationships: []
      }
      incident_report_images: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          id: string
          incident_report_id: string
          organization_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          id?: string
          incident_report_id: string
          organization_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          id?: string
          incident_report_id?: string
          organization_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_report_images_incident_report_id_fkey"
            columns: ["incident_report_id"]
            isOneToOne: false
            referencedRelation: "incident_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          address: string | null
          category: string
          client_id: string | null
          contact: string | null
          created_at: string
          description: string
          id: string
          image_count: number
          latitude: number | null
          longitude: number | null
          manual_location: string | null
          occurred_at: string
          organization_id: string | null
          assigned_team_id: string | null
          reporter_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          category: string
          client_id?: string | null
          contact?: string | null
          created_at?: string
          description: string
          id?: string
          image_count?: number
          latitude?: number | null
          longitude?: number | null
          manual_location?: string | null
          occurred_at?: string
          organization_id?: string | null
          assigned_team_id?: string | null
          reporter_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string
          client_id?: string | null
          contact?: string | null
          created_at?: string
          description?: string
          id?: string
          image_count?: number
          latitude?: number | null
          longitude?: number | null
          manual_location?: string | null
          occurred_at?: string
          organization_id?: string | null
          assigned_team_id?: string | null
          reporter_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_cron_secrets: {
        Row: {
          created_at: string
          name: string
          secret: string
        }
        Insert: {
          created_at?: string
          name: string
          secret?: string
        }
        Update: {
          created_at?: string
          name?: string
          secret?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          id: string
          link: string | null
          metadata: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          paystack_event_id: string | null
          reference: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          paystack_event_id?: string | null
          reference?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          paystack_event_id?: string | null
          reference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          billing_interval: string
          code: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_custom: boolean
          max_cameras: number
          max_deployments: number
          name: string
          paystack_plan_code: string | null
          price_ngn_kobo: number
          retention_days: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_interval?: string
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_custom?: boolean
          max_cameras?: number
          max_deployments?: number
          name: string
          paystack_plan_code?: string | null
          price_ngn_kobo?: number
          retention_days?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_interval?: string
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_custom?: boolean
          max_cameras?: number
          max_deployments?: number
          name?: string
          paystack_plan_code?: string | null
          price_ngn_kobo?: number
          retention_days?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      safebenue_early_warnings: {
        Row: {
          author_id: string
          category: string
          community: string
          created_at: string
          description: string
          id: string
          latitude: number | null
          location_accuracy_m: number | null
          longitude: number | null
          moderator_note: string | null
          occurred_at: string
          severity: string
          status: string
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          ward: string | null
        }
        Insert: {
          author_id: string
          category?: string
          community: string
          created_at?: string
          description: string
          id?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          longitude?: number | null
          moderator_note?: string | null
          occurred_at?: string
          severity?: string
          status?: string
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          ward?: string | null
        }
        Update: {
          author_id?: string
          category?: string
          community?: string
          created_at?: string
          description?: string
          id?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          longitude?: number | null
          moderator_note?: string | null
          occurred_at?: string
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          ward?: string | null
        }
        Relationships: []
      }
      safebenue_warning_confirmations: {
        Row: {
          created_at: string
          id: string
          user_id: string
          warning_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          warning_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          warning_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safebenue_warning_confirmations_warning_id_fkey"
            columns: ["warning_id"]
            isOneToOne: false
            referencedRelation: "safebenue_early_warnings"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_configs: {
        Row: {
          critical_threshold: number
          enabled: boolean
          id: string
          sensitivity: number
          sensor_key: string
          updated_at: string
          user_id: string
          warning_threshold: number
        }
        Insert: {
          critical_threshold?: number
          enabled?: boolean
          id?: string
          sensitivity?: number
          sensor_key: string
          updated_at?: string
          user_id: string
          warning_threshold?: number
        }
        Update: {
          critical_threshold?: number
          enabled?: boolean
          id?: string
          sensitivity?: number
          sensor_key?: string
          updated_at?: string
          user_id?: string
          warning_threshold?: number
        }
        Relationships: []
      }
      smart_rule_configs: {
        Row: {
          auto_snapshot_interval_sec: number
          baseline: Json
          created_at: string
          id: string
          ignore_normal_movement: boolean
          odd_hours_enabled: boolean
          odd_hours_end: number
          odd_hours_start: number
          repeated_motion_count: number
          repeated_motion_enabled: boolean
          repeated_motion_window_sec: number
          unknown_pattern_enabled: boolean
          unknown_pattern_sensitivity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_snapshot_interval_sec?: number
          baseline?: Json
          created_at?: string
          id?: string
          ignore_normal_movement?: boolean
          odd_hours_enabled?: boolean
          odd_hours_end?: number
          odd_hours_start?: number
          repeated_motion_count?: number
          repeated_motion_enabled?: boolean
          repeated_motion_window_sec?: number
          unknown_pattern_enabled?: boolean
          unknown_pattern_sensitivity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_snapshot_interval_sec?: number
          baseline?: Json
          created_at?: string
          id?: string
          ignore_normal_movement?: boolean
          odd_hours_enabled?: boolean
          odd_hours_end?: number
          odd_hours_start?: number
          repeated_motion_count?: number
          repeated_motion_enabled?: boolean
          repeated_motion_window_sec?: number
          unknown_pattern_enabled?: boolean
          unknown_pattern_sensitivity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          paystack_customer_code: string | null
          paystack_email_token: string | null
          paystack_subscription_code: string | null
          plan_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string | null
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          paystack_customer_code?: string | null
          paystack_email_token?: string | null
          paystack_subscription_code?: string | null
          plan_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_state: {
        Row: {
          arm_status: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arm_status?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arm_status?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_alert_settings: {
        Row: {
          cooldown_minutes: number
          created_at: string
          dead_letter_threshold: number
          enabled: boolean
          latency_p95_threshold_ms: number
          updated_at: string
          user_id: string
          window_minutes: number
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          dead_letter_threshold?: number
          enabled?: boolean
          latency_p95_threshold_ms?: number
          updated_at?: string
          user_id: string
          window_minutes?: number
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          dead_letter_threshold?: number
          enabled?: boolean
          latency_p95_threshold_ms?: number
          updated_at?: string
          user_id?: string
          window_minutes?: number
        }
        Relationships: []
      }
      webhook_alerts: {
        Row: {
          acknowledged: boolean
          created_at: string
          id: string
          kind: string
          message: string
          threshold: number
          user_id: string
          value: number
          window_minutes: number
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          kind: string
          message: string
          threshold: number
          user_id: string
          value: number
          window_minutes: number
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          kind?: string
          message?: string
          threshold?: number
          user_id?: string
          value?: number
          window_minutes?: number
        }
        Relationships: []
      }
      webhook_dead_letter: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number
          next_retry_at: string
          payload: Json
          reference: string | null
          signature: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload: Json
          reference?: string | null
          signature?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload?: Json
          reference?: string | null
          signature?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string
          error: string | null
          event_type: string | null
          id: string
          latency_ms: number
          reference: string | null
          source: string
          status: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          latency_ms?: number
          reference?: string | null
          source: string
          status: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          latency_ms?: number
          reference?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      assign_incident_team: {
        Args: { _incident_id: string; _note?: string | null; _team_id: string }
        Returns: Database["public"]["Tables"]["incident_reports"]["Row"]
      }
      dispatch_incident: {
        Args: { _incident_id: string; _note?: string | null }
        Returns: Database["public"]["Tables"]["incident_reports"]["Row"]
      }
      get_incident_actor_names: {
        Args: { _actor_ids: string[]; _organization_id: string }
        Returns: { display_name: string; user_id: string }[]
      }
      get_response_team_roster: {
        Args: { _organization_id: string }
        Returns: {
          team_id: string
          team_name: string
          team_type: string
          membership_id: string | null
          user_id: string | null
          display_name: string
          membership_status: string | null
        }[]
      }
      purge_face_audit: { Args: never; Returns: number }
      transition_incident: {
        Args: {
          _incident_id: string
          _note?: string | null
          _to_status: string
        }
        Returns: Database["public"]["Tables"]["incident_reports"]["Row"]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      notification_category:
        | "incident"
        | "community_alert"
        | "ai_detection"
        | "system"
        | "auth"
      notification_priority: "low" | "normal" | "high" | "critical"
      membership_status: "invited" | "active" | "suspended"
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
      app_role: ["admin", "moderator", "user"],
      notification_category: [
        "incident",
        "community_alert",
        "ai_detection",
        "system",
        "auth",
      ],
      notification_priority: ["low", "normal", "high", "critical"],
    },
  },
} as const
