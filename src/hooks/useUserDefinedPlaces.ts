
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserDefinedPlace } from '../types';
import { getDebugMessage } from '../utils/helpers';

// A utility function to parse the PostGIS POINT string 'POINT(lng lat)'
const parsePoint = (pointString: string): { lat: number; lng: number } | null => {
    if (!pointString || typeof pointString !== 'string') return null;
    const match = pointString.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if (match && match[1] && match[2]) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        return { lat, lng };
    }
    return null;
};

interface RpcPlace {
    id: string;
    created_at: string;
    name: string;
    location_text: string;
    user_id: string;
}

export const useUserDefinedPlaces = () => {
    const [userDefinedPlaces, setUserDefinedPlaces] = useState<UserDefinedPlace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlaces = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Using a RPC function is safer for selecting geography columns as text
            const { data, error: rpcError } = await supabase.rpc<RpcPlace[]>('get_all_user_places');
            
            if (rpcError) {
                console.error("useUserDefinedPlaces: Error fetching places via RPC", getDebugMessage(rpcError), rpcError);
                throw rpcError;
            }

            if (data) {
                const parsedPlaces = data.map((item: RpcPlace) => {
                    const location = parsePoint(item.location_text);
                    if (!location) return null; // Skip if location is invalid
                    
                    return {
                        id: item.id,
                        created_at: item.created_at,
                        name: item.name,
                        location: location,
                        user_id: item.user_id,
                    };
                }).filter((p): p is UserDefinedPlace => p !== null); // Filter out nulls
                
                setUserDefinedPlaces(parsedPlaces);
            }

        } catch (err: any) {
            setError('Failed to load defined places.');
            console.error(getDebugMessage(err), err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlaces();

        const channel = supabase
            .channel('user_defined_places_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_defined_places' },
                () => {
                    // Refetch the entire list on any change to ensure data consistency
                    // and avoid parsing differences between initial fetch and realtime updates.
                    fetchPlaces();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchPlaces]);

    return { userDefinedPlaces, isLoading, error, refetch: fetchPlaces };
};

// NOTE: This hook depends on a Supabase RPC function named `get_all_user_places`.
// You must create this function in your Supabase SQL Editor. If you are updating the function
// because its returned columns have changed, you MUST drop the old one first.
/*
-- First, safely remove the old function if it exists.
-- This is necessary if you are changing the columns it returns.
DROP FUNCTION IF EXISTS public.get_all_user_places();

-- Now, create the corrected function.
CREATE OR REPLACE FUNCTION public.get_all_user_places()
RETURNS TABLE(
    id uuid,
    created_at timestamptz,
    name text,
    location_text text, -- Return geography as text
    user_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function now respects Row Level Security by only returning places for the currently authenticated user.
    RETURN QUERY 
    SELECT 
        udp.id,
        udp.created_at,
        udp.name,
        ST_AsText(udp.location) as location_text,
        udp.user_id
    FROM 
        public.user_defined_places AS udp
    WHERE
        auth.uid() = udp.user_id; -- This ensures users only get their own places
END;
$$;
*/
