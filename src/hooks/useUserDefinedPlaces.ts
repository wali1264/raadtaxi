
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { UserDefinedPlace } from '../types';
import { getDebugMessage } from '../utils/helpers';

// A utility function to parse the PostGIS POINT string 'POINT(lng lat)'
const parsePoint = (pointString: string): { lat: number; lng: number } | null => {
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
    type: string | null;
    created_by_user_id: string;
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
                        type: item.type,
                        created_by_user_id: item.created_by_user_id,
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
                { event: 'INSERT', schema: 'public', table: 'user_defined_places' },
                (payload) => {
                    const location = parsePoint((payload.new as any).location);
                    if (location) {
                         const newPlace: UserDefinedPlace = {
                            id: payload.new.id,
                            created_at: payload.new.created_at,
                            name: payload.new.name,
                            location: location,
                            type: payload.new.type,
                            created_by_user_id: payload.new.created_by_user_id,
                        };
                        setUserDefinedPlaces((prevPlaces) => [...prevPlaces, newPlace]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchPlaces]);

    return { userDefinedPlaces, isLoading, error, refetch: fetchPlaces };
};

// NOTE: This hook depends on a new Supabase RPC function named `get_all_user_places`.
// You must create this function in your Supabase SQL Editor:
/*
CREATE OR REPLACE FUNCTION get_all_user_places()
RETURNS TABLE(
    id uuid,
    created_at timestamptz,
    name text,
    location_text text, -- Return geography as text
    type text,
    created_by_user_id uuid
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        udp.id,
        udp.created_at,
        udp.name,
        ST_AsText(udp.location) as location_text,
        udp.type,
        udp.created_by_user_id
    FROM 
        public.user_defined_places udp;
END;
$$ LANGUAGE plpgsql;
*/
