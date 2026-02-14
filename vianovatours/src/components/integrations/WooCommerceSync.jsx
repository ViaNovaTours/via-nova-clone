import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchWooCommerceOrders } from '@/functions/fetchWooCommerceOrders';
import { useToast } from '@/components/ui/use-toast';

export default function WooCommerceSync({ onSyncComplete }) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSync = async () => {
        setIsLoading(true);
        try {
            const { data } = await fetchWooCommerceOrders();
            
            if (data.success) {
                const description = (
                    <div className="text-sm space-y-1">
                        <p><strong>New Orders:</strong> {data.total_new_orders || 0} imported</p>
                        <p><strong>Status Updates:</strong> {data.status_updates || 0} orders updated</p>
                        <p><strong>Duplicates Merged:</strong> {data.merged_duplicates || 0}</p>
                        {data.errors && data.errors.length > 0 && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                                <p className="font-bold text-red-800">Sync Errors:</p>
                                <ul className="list-disc list-inside text-xs text-red-700">
                                    {data.errors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                );

                toast({
                    title: "Full Sync Complete ✅",
                    description: description,
                    duration: 8000,
                });
                onSyncComplete();
            } else {
                toast({
                    title: "Sync Failed",
                    description: data.error || "Unknown error occurred",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Sync failed:", error);
            toast({
                title: "Sync Error",
                description: error?.message || "Failed to connect to sync service",
                variant: "destructive",
            });
        }
        setIsLoading(false);
    };

    return (
        <Button
            onClick={handleSync}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
            {isLoading ? "Syncing All Sites..." : "Sync WooCommerce"}
        </Button>
    );
}