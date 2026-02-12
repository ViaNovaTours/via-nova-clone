import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Edit2, Ticket, DollarSign, AlertTriangle, Calculator } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function QuickTicketEdit({ order, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTickets, setEditedTickets] = useState(order.tickets || []);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");
  const { toast } = useToast();

  const getTotalTickets = (tickets) => {
    return tickets.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0);
  };

  const handleTicketChange = (index, quantity) => {
    const newTickets = [...editedTickets];
    newTickets[index].quantity = parseInt(quantity) || 0;
    setEditedTickets(newTickets);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const oldTotal = order.total_cost || 0;
      const newTotalCost = oldTotal - refundAmount;
      
      // Recalculate costs based on new quantities
      const totalTickets = getTotalTickets(editedTickets);
      const oldTotalTickets = getTotalTickets(order.tickets);
      
      // Proportionally adjust ticket costs
      const costPerTicket = order.total_ticket_cost / oldTotalTickets || 0;
      const newTotalTicketCost = costPerTicket * totalTickets;
      const newProjectedProfit = newTotalCost - newTotalTicketCost;

      const updates = {
        tickets: editedTickets.filter(t => t.quantity > 0),
        total_cost: newTotalCost,
        total_ticket_cost: newTotalTicketCost,
        projected_profit: newProjectedProfit,
        processing_notes: order.processing_notes 
          ? `${order.processing_notes}\n\n[${new Date().toLocaleString()}] Ticket adjustment: ${oldTotalTickets} → ${totalTickets} tickets. Refund: ${refundAmount} ${order.currency}. Reason: ${refundReason || 'Not specified'}`
          : `[${new Date().toLocaleString()}] Ticket adjustment: ${oldTotalTickets} → ${totalTickets} tickets. Refund: ${refundAmount} ${order.currency}. Reason: ${refundReason || 'Not specified'}`
      };

      await onUpdate(updates);
      
      toast({
        title: "Tickets Updated ✅",
        description: `Order updated: ${totalTickets} tickets, ${refundAmount > 0 ? `refund of ${refundAmount} ${order.currency}` : 'no refund'}`,
        duration: 5000
      });

      setIsEditing(false);
      setRefundAmount(0);
      setRefundReason("");
    } catch (error) {
      console.error("Failed to update tickets:", error);
      toast({
        title: "Update Failed ❌",
        description: "Could not update order. Please try again.",
        variant: "destructive"
      });
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedTickets(order.tickets || []);
    setRefundAmount(0);
    setRefundReason("");
    setIsEditing(false);
  };

  const oldTotal = getTotalTickets(order.tickets);
  const newTotal = getTotalTickets(editedTickets);
  const ticketChange = newTotal - oldTotal;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: order.currency || 'EUR'
    }).format(value);
  };

  if (!isEditing) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Ticket Summary
            </span>
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <Edit2 className="w-3 h-3 mr-2" />
              Edit Tickets
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.tickets?.map((ticket, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="text-slate-600">{ticket.type}</span>
              <span className="font-medium text-slate-900">{ticket.quantity}x</span>
            </div>
          ))}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex justify-between items-center font-semibold">
              <span className="text-slate-800">Total Tickets</span>
              <span className="text-emerald-600">{oldTotal}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <Edit2 className="w-5 h-5 text-amber-600" />
          Edit Ticket Quantities
        </CardTitle>
        <div className="bg-amber-100 p-3 rounded-lg mt-2">
          <p className="text-sm text-amber-900 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Adjusting tickets for refunds or duplicates
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="font-medium text-slate-700">Ticket Quantities</Label>
          {editedTickets.map((ticket, index) => (
            <div key={index} className="grid grid-cols-5 items-center gap-3">
              <Label className="text-sm text-slate-600 col-span-2">{ticket.type}</Label>
              <Input
                type="number"
                min="0"
                value={ticket.quantity}
                onChange={(e) => handleTicketChange(index, e.target.value)}
                className="h-9 col-span-3"
              />
            </div>
          ))}
        </div>

        <div className="bg-slate-100 p-4 rounded-lg space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">Original Total</span>
            <span className="font-medium">{oldTotal} tickets</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">New Total</span>
            <span className="font-medium text-emerald-600">{newTotal} tickets</span>
          </div>
          {ticketChange !== 0 && (
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-slate-800">Change</span>
              <span className={ticketChange > 0 ? "text-emerald-600" : "text-red-600"}>
                {ticketChange > 0 ? '+' : ''}{ticketChange} tickets
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-300 pt-4">
          <Label className="font-medium text-slate-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Refund Amount
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              max={order.total_cost || 0}
              value={refundAmount}
              onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
            <span className="text-sm text-slate-600">{order.currency || 'EUR'}</span>
          </div>
          <p className="text-xs text-slate-500">
            Original: {formatCurrency(order.total_cost || 0)} → New: {formatCurrency((order.total_cost || 0) - refundAmount)}
          </p>

          <Label className="font-medium text-slate-700 block mt-4">Refund Reason</Label>
          <Textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="e.g., Duplicate order, customer requested reduction..."
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <>
                <Calculator className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}