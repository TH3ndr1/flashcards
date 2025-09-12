-- Add feature flag columns to the settings table
-- Feature flags are active by default (true) and get deactivated when child_mode is enabled

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS settings_access_enabled BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS edit_functionality_enabled BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS child_mode_enabled BOOLEAN DEFAULT false NOT NULL;

-- Add comment to document the feature flag system
COMMENT ON COLUMN settings.settings_access_enabled IS 'Feature flag: Controls access to settings page. Deactivated when child_mode_enabled is true.';
COMMENT ON COLUMN settings.edit_functionality_enabled IS 'Feature flag: Controls access to deck editing functionality. Deactivated when child_mode_enabled is true.';
COMMENT ON COLUMN settings.child_mode_enabled IS 'Child mode toggle: When enabled, deactivates other feature flags for safety.';

-- Create a function to automatically update feature flags when child mode changes
CREATE OR REPLACE FUNCTION update_feature_flags_on_child_mode()
RETURNS TRIGGER AS $$
BEGIN
    -- If child_mode is being enabled, we don't need to do anything special
    -- The application logic will handle checking child_mode_enabled to override other flags
    
    -- Log the change for debugging purposes
    RAISE NOTICE 'Child mode changed for user %: %', NEW.user_id, NEW.child_mode_enabled;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run the function when settings are updated
DROP TRIGGER IF EXISTS trigger_update_feature_flags_on_child_mode ON settings;
CREATE TRIGGER trigger_update_feature_flags_on_child_mode
    AFTER UPDATE OF child_mode_enabled ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_flags_on_child_mode();
