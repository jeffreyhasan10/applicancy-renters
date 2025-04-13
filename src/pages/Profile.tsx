
import { CameraIcon, Mail, Phone, Save, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/common/PageHeader";

export default function Profile() {
  const { user } = useAuth();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Mock profile data
  const [profileData, setProfileData] = useState({
    firstName: "Admin",
    lastName: "User",
    email: user?.email || "admin@applicancy.com",
    phone: "+91 98765 43210",
    jobTitle: "Property Manager",
    company: "Applicancy Renters",
    bio: "Experienced property manager with a focus on luxury rentals and tenant satisfaction. Passionate about delivering exceptional service and maintaining high-end properties.",
  });

  return (
    <>
      <PageHeader 
        title="My Profile" 
        description="View and edit your profile information"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 lg:row-span-2 h-min">
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative mb-4">
              <div className="h-32 w-32 rounded-full bg-luxury-gold/20 flex items-center justify-center text-4xl font-bold text-luxury-gold overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profileData.firstName.charAt(0) + profileData.lastName.charAt(0)
                )}
              </div>
              <label htmlFor="profile-image" className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer">
                <CameraIcon className="h-4 w-4" />
                <input 
                  id="profile-image" 
                  type="file" 
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setProfileImage(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
            <h3 className="font-medium text-lg">{profileData.firstName} {profileData.lastName}</h3>
            <p className="text-sm text-gray-500">{profileData.jobTitle}</p>
            
            <div className="w-full mt-4 space-y-2">
              <div className="flex items-center">
                <Mail className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm">{profileData.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-gray-500 mr-2" />
                <span className="text-sm">{profileData.phone}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="personal">
              <TabsList className="mb-4">
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
              </TabsList>
              
              <TabsContent value="personal" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-title">Job Title</Label>
                    <Input
                      id="job-title"
                      value={profileData.jobTitle}
                      onChange={(e) => setProfileData({...profileData, jobTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={profileData.company}
                      onChange={(e) => setProfileData({...profileData, company: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      rows={4}
                      value={profileData.bio}
                      onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                    />
                  </div>
                </div>
                
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </TabsContent>
              
              <TabsContent value="preferences" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <select id="language" className="w-full h-10 px-3 border rounded-md">
                      <option value="en">English</option>
                      <option value="hi">Hindi</option>
                      <option value="bn">Bengali</option>
                      <option value="te">Telugu</option>
                      <option value="ta">Tamil</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="time-zone">Time Zone</Label>
                    <select id="time-zone" className="w-full h-10 px-3 border rounded-md">
                      <option value="IST">(GMT+5:30) India Standard Time</option>
                      <option value="PST">(GMT-8:00) Pacific Standard Time</option>
                      <option value="EST">(GMT-5:00) Eastern Standard Time</option>
                      <option value="GMT">(GMT+0:00) Greenwich Mean Time</option>
                      <option value="JST">(GMT+9:00) Japan Standard Time</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date-format">Date Format</Label>
                    <select id="date-format" className="w-full h-10 px-3 border rounded-md">
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <select id="currency" className="w-full h-10 px-3 border rounded-md">
                      <option value="INR">Indian Rupee (₹)</option>
                      <option value="USD">US Dollar ($)</option>
                      <option value="EUR">Euro (€)</option>
                      <option value="GBP">British Pound (£)</option>
                    </select>
                  </div>
                </div>
                
                <Button>
                  <UserCog className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </TabsContent>
              
              <TabsContent value="notifications" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-gray-500">Receive email notifications</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="email-notif" className="w-4 h-4" defaultChecked />
                      <Label htmlFor="email-notif">Enabled</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-gray-500">Receive SMS notifications</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="sms-notif" className="w-4 h-4" />
                      <Label htmlFor="sms-notif">Disabled</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-medium">Browser Notifications</p>
                      <p className="text-sm text-gray-500">Receive notifications in your browser</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="browser-notif" className="w-4 h-4" defaultChecked />
                      <Label htmlFor="browser-notif">Enabled</Label>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="font-medium">Rent Payment Alerts</p>
                      <p className="text-sm text-gray-500">Get notified about rent payments</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="rent-notif" className="w-4 h-4" defaultChecked />
                      <Label htmlFor="rent-notif">Enabled</Label>
                    </div>
                  </div>
                </div>
                
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Notification Settings
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Recent account activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-b pb-3">
                <div className="flex justify-between">
                  <p className="font-medium">Login</p>
                  <span className="text-sm text-gray-500">Today, 9:30 AM</span>
                </div>
                <p className="text-sm text-gray-500">IP: 192.168.1.1 • Chrome on Windows</p>
              </div>
              
              <div className="border-b pb-3">
                <div className="flex justify-between">
                  <p className="font-medium">Profile Updated</p>
                  <span className="text-sm text-gray-500">Yesterday, 3:45 PM</span>
                </div>
                <p className="text-sm text-gray-500">Updated personal information</p>
              </div>
              
              <div className="border-b pb-3">
                <div className="flex justify-between">
                  <p className="font-medium">Login</p>
                  <span className="text-sm text-gray-500">Yesterday, 10:15 AM</span>
                </div>
                <p className="text-sm text-gray-500">IP: 192.168.1.1 • Chrome on Windows</p>
              </div>
              
              <div className="border-b pb-3">
                <div className="flex justify-between">
                  <p className="font-medium">Password Changed</p>
                  <span className="text-sm text-gray-500">Apr 3, 2025, 2:20 PM</span>
                </div>
                <p className="text-sm text-gray-500">Password was changed successfully</p>
              </div>
              
              <div className="border-b pb-3">
                <div className="flex justify-between">
                  <p className="font-medium">Login</p>
                  <span className="text-sm text-gray-500">Apr 3, 2025, 9:05 AM</span>
                </div>
                <p className="text-sm text-gray-500">IP: 192.168.1.1 • Chrome on Windows</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
