import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateSpecificOrderStatus } from '@/functions/updateSpecificOrderStatus';
import { Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function UpdateOrderStatuses({ onComplete }) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleUpdate = async () => {
        setIsLoading(true);
        try {
            const { data } = await updateSpecificOrderStatus();
            setResult(data);
            if (onComplete) onComplete();
        } catch (error) {
            console.error("Update failed:", error);
            setResult({ success: false, error: error.message });
        }
        setIsLoading(false);
    };

    return (
        <div className="space-y-4">
            <Button
                onClick={handleUpdate}
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2 bg-blue-50 border-blue-200 hover:bg-blue-100"
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <RefreshCw className="w-4 h-4" />
                )}
                {isLoading ? "Checking Past Due Orders..." : "Update Past Due Orders"}
            </Button>

            {result && (
                <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    <AlertDescription className={result.success ? "text-green-800" : "text-red-800"}>
                        {result.success ? (
                            <div>
                                <strong>Status Check Complete!</strong>
                                <br />
                                <small>Checked: {result.orders_checked} orders</small>
                                <br />
                                <small>Updated: {result.orders_updated} orders</small>
                                {result.results && result.results.length > 0 && (
                                    <div className="mt-2 text-xs">
                                        {result.results.filter(r => r.needs_update).map((order, i) => (
                                            <div key={i} className="border-t border-green-300 pt-1 mt-1">
                                                {order.customer} - {order.woocommerce_status} → {order.mapped_status}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div><strong>Error:</strong> {result.error}</div>
                        )}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}