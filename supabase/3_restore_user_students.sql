-- STEP 3: RESTORE USER_STUDENTS
-- Run this script to fix the 'relation public.user_students does not exist' error.
-- Note: 'student_id' changed to UUID to match the current 'students' table schema.

CREATE TABLE IF NOT EXISTS public.user_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one link per student-user pair
    UNIQUE(user_id, student_id)
);

-- Enable RLS
ALTER TABLE public.user_students ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own links
DROP POLICY IF EXISTS "Users can view own student links" ON public.user_students;
CREATE POLICY "Users can view own student links" ON public.user_students
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Masters/Owners can view all links (for the Admin Panel)
DROP POLICY IF EXISTS "Master/Owner view all student links" ON public.user_students;
CREATE POLICY "Master/Owner view all student links" ON public.user_students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role IN ('master', 'owner')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.tenants 
            WHERE owner_id = auth.uid()
        )
    );
