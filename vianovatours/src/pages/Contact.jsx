import React, { useState, useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Clock, MessageCircle } from "lucide-react";
import TourFooter from "../components/tour-landing/TourFooter";
import TourNavigation from "../components/tour-landing/TourNavigation";
import { useToast } from "@/components/ui/use-toast";

Contact.useLayout = false;

export default function Contact() {
  const [tourConfig, setTourConfig] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadTourConfig = async () => {
      const hostname = window.location.hostname;
      const tours = await base44.entities.TourLandingPage.filter({ 
        domain: hostname,
        is_active: true 
      });
      if (tours.length > 0) setTourConfig(tours[0]);
    };
    loadTourConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Send email using Core.SendEmail integration
      await base44.integrations.Core.SendEmail({
        to: tourConfig.confirmation_email_from,
        subject: `Contact Form: ${formData.subject}`,
        body: `
          Name: ${formData.name}
          Email: ${formData.email}
          Subject: ${formData.subject}
          
          Message:
          ${formData.message}
        `
      });

      toast({
        title: "Message Sent!",
        description: "We'll get back to you within 24-48 hours."
      });

      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      toast({
        title: "Failed to Send",
        description: "Please try again or email us directly.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tourConfig) return null;

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-white">
      <Helmet>
        <title>Contact Us – {tourConfig.tour_name}</title>
        <meta name="description" content={`Contact ${tourConfig.tour_name} customer support for booking assistance.`} />
      </Helmet>

      <TourNavigation tourName={tourConfig.tour_name} />

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Contact Us</h1>
          <p className="text-lg text-slate-600">
            Have questions about your booking? We're here to help.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-6">Send Us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="Your name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  required
                  placeholder="What can we help you with?"
                />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
                  rows={6}
                  placeholder="Please include your booking number if you have one..."
                />
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">Get in Touch</h2>
              <div className="space-y-6">
                {tourConfig.confirmation_email_from && (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Email Us</h3>
                      <p className="text-slate-600">{tourConfig.confirmation_email_from}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Response Time</h3>
                    <p className="text-slate-600">We typically respond within 24-48 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Support Hours</h3>
                    <p className="text-slate-600">Monday - Friday: 9:00 AM - 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-3">Before You Contact Us</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Check your spam folder for booking confirmations</li>
                <li>• Have your booking number ready</li>
                <li>• Review our FAQ section for quick answers</li>
                <li>• Allow 24-48 hours for email responses</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <TourFooter tourConfig={tourConfig} />
      </div>
    </HelmetProvider>
  );
}