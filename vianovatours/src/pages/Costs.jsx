import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, X, Edit2, DollarSign, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const COST_CATEGORIES = [
  { key: 'va_costs', label: 'VAs' },
  { key: 'make_com', label: 'Make.com' },
  { key: 'gmail_templates', label: 'Gmail Templates' },
  { key: 'slack', label: 'Slack' },
  { key: 'siteground', label: 'Siteground' },
  { key: 'sendgrid', label: 'Sendgrid' },
  { key: 'google_workspace', label: 'Google Workspace' },
  { key: 'zerobounce', label: 'ZeroBounce' },
  { key: 'digital_ocean', label: 'Digital Ocean' },
  { key: 'base44', label: 'Base44' },
  { key: 'other_costs', label: 'Other' }
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CostsPage() {
  const [user, setUser] = useState(null);
  const [costs, setCosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCost, setNewCost] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    currency: 'USD'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        toast({
          title: "Access Denied",
          description: "Only admins can view costs",
          variant: "destructive"
        });
        return;
      }

      const costsData = await base44.entities.MonthlyCosts.list('-year', 100);
      setCosts(costsData.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      }));
    } catch (error) {
      console.error("Error loading costs:", error);
      toast({
        title: "Error",
        description: "Failed to load costs",
        variant: "destructive"
      });
    }
    setIsLoading(false);
  };

  const calculateTotal = (costRecord) => {
    return COST_CATEGORIES.reduce((sum, cat) => sum + (costRecord[cat.key] || 0), 0);
  };

  const handleEdit = (cost) => {
    setEditingId(cost.id);
    setEditData({ ...cost });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    try {
      await base44.entities.MonthlyCosts.update(editingId, editData);
      await loadData();
      setEditingId(null);
      setEditData({});
      toast({
        title: "Updated ✅",
        description: "Cost record updated successfully"
      });
    } catch (error) {
      console.error("Error updating cost:", error);
      toast({
        title: "Error",
        description: "Failed to update cost",
        variant: "destructive"
      });
    }
  };

  const handleAddNew = async () => {
    try {
      await base44.entities.MonthlyCosts.create(newCost);
      await loadData();
      setIsAddingNew(false);
      setNewCost({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        currency: 'USD'
      });
      toast({
        title: "Added ✅",
        description: "New cost record created"
      });
    } catch (error) {
      console.error("Error adding cost:", error);
      toast({
        title: "Error",
        description: "Failed to add cost record",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCost = async (id) => {
    if (!confirm("Are you sure you want to delete this cost record?")) return;
    
    try {
      await base44.entities.MonthlyCosts.delete(id);
      await loadData();
      toast({
        title: "Deleted ✅",
        description: "Cost record deleted"
      });
    } catch (error) {
      console.error("Error deleting cost:", error);
      toast({
        title: "Error",
        description: "Failed to delete cost",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-800 font-medium">Access Denied - Admin Only</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAnnualCosts = costs
    .filter(c => c.year === new Date().getFullYear())
    .reduce((sum, c) => sum + calculateTotal(c), 0);

  const avgMonthlyCosts = costs.length > 0 
    ? totalAnnualCosts / Math.min(12, costs.filter(c => c.year === new Date().getFullYear()).length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Monthly Costs</h1>
          <p className="text-slate-600 mt-1">Track your operational expenses</p>
        </div>
        <Button 
          onClick={() => setIsAddingNew(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Month
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {new Date().getFullYear()} Total Costs
            </CardTitle>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              ${totalAnnualCosts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Average Monthly
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              ${avgMonthlyCosts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Period</TableHead>
                  {COST_CATEGORIES.map(cat => (
                    <TableHead key={cat.key} className="font-semibold text-right min-w-[100px]">
                      {cat.label}
                    </TableHead>
                  ))}
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingNew && (
                  <TableRow className="bg-blue-50">
                    <TableCell>
                      <div className="flex gap-2">
                        <select
                          value={newCost.month}
                          onChange={(e) => setNewCost({...newCost, month: parseInt(e.target.value)})}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          {MONTHS.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          value={newCost.year}
                          onChange={(e) => setNewCost({...newCost, year: parseInt(e.target.value)})}
                          className="w-24"
                        />
                      </div>
                    </TableCell>
                    {COST_CATEGORIES.map(cat => (
                      <TableCell key={cat.key}>
                        <Input
                          type="number"
                          step="0.01"
                          value={newCost[cat.key] || 0}
                          onChange={(e) => setNewCost({...newCost, [cat.key]: parseFloat(e.target.value) || 0})}
                          className="text-right w-24"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">
                      ${calculateTotal(newCost).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsAddingNew(false)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {costs.map(cost => {
                  const isEditing = editingId === cost.id;
                  const data = isEditing ? editData : cost;

                  return (
                    <TableRow key={cost.id} className={isEditing ? 'bg-amber-50' : ''}>
                      <TableCell className="font-medium">
                        {MONTHS[cost.month - 1]} {cost.year}
                      </TableCell>
                      {COST_CATEGORIES.map(cat => (
                        <TableCell key={cat.key} className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={data[cat.key] || 0}
                              onChange={(e) => setEditData({...editData, [cat.key]: parseFloat(e.target.value) || 0})}
                              className="text-right w-24"
                            />
                          ) : (
                            <span className={data[cat.key] > 0 ? 'text-slate-900' : 'text-slate-400'}>
                              ${(data[cat.key] || 0).toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold text-slate-900">
                        ${calculateTotal(data).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 justify-center">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(cost)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleDeleteCost(cost.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}