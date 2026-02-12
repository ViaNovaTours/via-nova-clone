import React, { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function StripeCheckout({ amount, currency, onSuccess, onError, disabled, isParentProcessing }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements || disabled) {
      return;
    }

    setIsProcessing(true);

    try {
      const cardElement = elements.getElement(CardElement);

      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        onError(error.message);
        setIsProcessing(false);
        return;
      }

      // Pass payment method to parent component
      onSuccess(paymentMethod);
    } catch (err) {
      onError(err.message);
      setIsProcessing(false);
    }
  };

  const cardStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1e293b',
        '::placeholder': {
          color: '#94a3b8',
        },
      },
      invalid: {
        color: '#ef4444',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-4 border border-slate-300 rounded-lg bg-white">
        <CardElement options={cardStyle} />
      </div>
      <Button 
        type="submit" 
        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700" 
        size="lg"
        disabled={!stripe || isProcessing || isParentProcessing || disabled}
      >
        {(isProcessing || isParentProcessing) ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          `Pay ${currency} ${amount.toFixed(2)}`
        )}
      </Button>
    </form>
  );
}