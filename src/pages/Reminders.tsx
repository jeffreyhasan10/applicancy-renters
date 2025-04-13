import { Bell, CheckCircle2, Clock, Plus, Search, Trash2 } from "lucide-react"; // Added Trash2 icon
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { typedSupabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/common/PageHeader";
import ActionModal from "@/components/dashboard/ActionModal";
import ReminderForm from "@/components/forms/ReminderForm";
import type { Database } from "@/integrations/supabase/types";

type Reminder = Database['public']['Tables']['reminders']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

export default function Reminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [addReminderModal, setAddReminderModal] = useState(false);
  const [markCompleteModal, setMarkCompleteModal] = useState(false);
  const [deleteReminderModal, setDeleteReminderModal] = useState(false); // New state for delete modal
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");

  // Fetch reminders with React Query
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .reminders()
        .select(`
          *,
          tenants (
            id,
            name
          )
        `)
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation for marking a reminder as complete
  const markCompleteMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string, notes: string }) => {
      const { error } = await typedSupabase
        .reminders()
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          completion_notes: notes
        })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast({
        title: "Task completed",
        description: "The reminder has been marked as complete.",
      });
      setMarkCompleteModal(false);
      setCompletionNotes("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to mark reminder as complete."
      });
    }
  });

  // Mutation for deleting a reminder
  const deleteReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await typedSupabase
        .reminders()
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast({
        title: "Reminder deleted",
        description: "The reminder has been successfully deleted.",
      });
      setDeleteReminderModal(false);
      setSelectedReminder(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete reminder."
      });
    }
  });

  const handleMarkComplete = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setMarkCompleteModal(true);
  };

  const handleDeleteReminder = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setDeleteReminderModal(true);
  };

  const confirmMarkComplete = () => {
    if (!selectedReminder) return;
    
    markCompleteMutation.mutate({
      id: selectedReminder.id,
      notes: completionNotes
    });
  };

  const confirmDeleteReminder = () => {
    if (!selectedReminder) return;
    
    deleteReminderMutation.mutate(selectedReminder.id);
  };

  // Format reminder date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Filter reminders based on status
  const pendingReminders = reminders.filter(reminder => reminder.status === "pending");
  const completedReminders = reminders.filter(reminder => reminder.status === "completed");
  const highPriorityPending = reminders.filter(r => r.status === "pending" && r.priority === "high");
  const mediumPriorityPending = reminders.filter(r => r.status === "pending" && r.priority === "medium");
  
  // Due soon reminders (due within 7 days)
  const dueSoonReminders = pendingReminders.filter(reminder => {
    const dueDate = new Date(reminder.due_date);
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    return dueDate >= today && dueDate <= sevenDaysFromNow;
  });

  // Filter reminders based on search query
  const filterBySearch = (remindersList: typeof reminders) => {
    if (!searchQuery) return remindersList;
    
    const query = searchQuery.toLowerCase();
    return remindersList.filter(reminder => 
      reminder.title.toLowerCase().includes(query) || 
      (reminder.description?.toLowerCase().includes(query)) ||
      (reminder.assigned_to?.toLowerCase().includes(query)) ||
      (reminder.tenants?.name?.toLowerCase().includes(query))
    );
  };

  return (
    <>
      <PageHeader 
        title="Reminders" 
        description="Manage tasks and reminders"
        onActionClick={() => setAddReminderModal(true)}
        actionLabel="Add Reminder"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pending Tasks</CardTitle>
            <CardDescription>Tasks that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-amber-500 mr-2" />
              <span className="text-2xl font-bold">{pendingReminders.length}</span>
            </div>
            <div className="mt-2 space-x-2">
              <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-200">
                {highPriorityPending.length} High Priority
              </Badge>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                {mediumPriorityPending.length} Medium Priority
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Due Soon</CardTitle>
            <CardDescription>Tasks due in next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-2xl font-bold">{dueSoonReminders.length}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => {
                setSearchQuery("");
                document.querySelector('[data-value="pending"]')?.click();
              }}
            >
              View Urgent Tasks
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Completed</CardTitle>
            <CardDescription>Recently completed tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-2xl font-bold">{completedReminders.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p>Loading reminders...</p>
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
                
                <div className="relative w-full md:w-64">
                  <Input
                    placeholder="Search reminders..."
                    className="pl-10 pr-3 py-2"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
              
              <TabsContent value="all">
                {filterBySearch(reminders).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No reminders found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterBySearch(reminders).map(reminder => (
                      <div key={reminder.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{reminder.title}</h3>
                            <Badge 
                              variant="outline" 
                              className={
                                reminder.priority === "high" 
                                  ? "bg-red-100 text-red-800 hover:bg-red-200 border-red-200" 
                                  : reminder.priority === "medium"
                                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"
                              }
                            >
                              {reminder.priority}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={
                                reminder.status === "completed" 
                                  ? "bg-green-100 text-green-800 hover:bg-green-200 border-green-200" 
                                  : "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                              }
                            >
                              {reminder.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{reminder.description}</p>
                          <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-4">
                            <span>Due: {formatDate(reminder.due_date)}</span>
                            <span>Assigned to: {reminder.assigned_to}</span>
                            {reminder.tenants?.name && (
                              <span>Tenant: {reminder.tenants.name}</span>
                            )}
                            {reminder.completed_at && (
                              <span>Completed: {formatDate(reminder.completed_at)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          {reminder.status === "pending" ? (
                            <>
                              <Button size="sm" onClick={() => handleMarkComplete(reminder)}>Mark Complete</Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleDeleteReminder(reminder)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm">View Details</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pending">
                {filterBySearch(pendingReminders).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No pending reminders found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterBySearch(pendingReminders).map(reminder => (
                      <div key={reminder.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{reminder.title}</h3>
                            <Badge 
                              variant="outline" 
                              className={
                                reminder.priority === "high" 
                                  ? "bg-red-100 text-red-800 hover:bg-red-200 border-red-200" 
                                  : reminder.priority === "medium"
                                    ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"
                              }
                            >
                              {reminder.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{reminder.description}</p>
                          <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-4">
                            <span>Due: {formatDate(reminder.due_date)}</span>
                            <span>Assigned to: {reminder.assigned_to}</span>
                            {reminder.tenants?.name && (
                              <span>Tenant: {reminder.tenants.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleMarkComplete(reminder)}>Mark Complete</Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDeleteReminder(reminder)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="completed">
                {filterBySearch(completedReminders).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No completed reminders found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filterBySearch(completedReminders).map(reminder => (
                      <div key={reminder.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{reminder.title}</h3>
                            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">
                              completed
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{reminder.description}</p>
                          <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-4">
                            <span>Due: {formatDate(reminder.due_date)}</span>
                            <span>Completed: {formatDate(reminder.completed_at || '')}</span>
                            <span>By: {reminder.assigned_to}</span>
                            {reminder.tenants?.name && (
                              <span>Tenant: {reminder.tenants.name}</span>
                            )}
                            {reminder.completion_notes && (
                              <span>Notes: {reminder.completion_notes}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm">View Details</Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleDeleteReminder(reminder)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
      
      {/* Add Reminder Modal */}
      <ReminderForm 
        open={addReminderModal}
        onOpenChange={setAddReminderModal}
      />
      
      {/* Mark Complete Modal */}
      <ActionModal
        title="Mark Reminder as Complete"
        description="Add details about the completed task"
        open={markCompleteModal}
        onOpenChange={setMarkCompleteModal}
      >
        {selectedReminder && (
          <div className="space-y-4">
            <div className="p-4 border rounded-md bg-gray-50">
              <h3 className="font-medium">{selectedReminder.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedReminder.description}</p>
              <div className="text-xs text-gray-500 mt-2">
                <span>Due: {formatDate(selectedReminder.due_date)}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Notes</label>
              <textarea 
                className="w-full px-3 py-2 border rounded-md" 
                rows={3} 
                placeholder="Add notes about task completion"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMarkCompleteModal(false)}>Cancel</Button>
              <Button 
                onClick={confirmMarkComplete}
                disabled={markCompleteMutation.isPending}
              >
                {markCompleteMutation.isPending ? "Saving..." : "Confirm Completion"}
              </Button>
            </div>
          </div>
        )}
      </ActionModal>
      
      {/* Delete Reminder Modal */}
      <ActionModal
        title="Delete Reminder"
        description="Are you sure you want to delete this reminder? This action cannot be undone."
        open={deleteReminderModal}
        onOpenChange={setDeleteReminderModal}
      >
        {selectedReminder && (
          <div className="space-y-4">
            <div className="p-4 border rounded-md bg-gray-50">
              <h3 className="font-medium">{selectedReminder.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{selectedReminder.description}</p>
              <div className="text-xs text-gray-500 mt-2">
                <span>Due: {formatDate(selectedReminder.due_date)}</span>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteReminderModal(false)}>Cancel</Button>
              <Button 
                variant="destructive"
                onClick={confirmDeleteReminder}
                disabled={deleteReminderMutation.isPending}
              >
                {deleteReminderMutation.isPending ? "Deleting..." : "Delete Reminder"}
              </Button>
            </div>
          </div>
        )}
      </ActionModal>
    </>
  );
}