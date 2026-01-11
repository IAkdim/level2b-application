// TEMPORARY MOCK DATA FOR VIDEO DEMO
// TO REMOVE: Delete this file and remove all imports of ENABLE_MOCK_DATA

export const ENABLE_MOCK_DATA = false // SET TO FALSE TO DISABLE MOCK DATA

import { Lead } from '@/types/crm'
import { Meeting } from './api/meetings'

// Mock Leads
export const MOCK_LEADS: Lead[] = [
  {
    id: 'mock-lead-1',
    org_id: 'mock-org',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1 555 1234 5678',
    company: 'TechCorp Solutions',
    title: 'Marketing Director',
    status: 'meeting_scheduled',
    sentiment: 'positive',
    source: ['LinkedIn', 'Referral'],
    language: 'en',
    notes: 'Very interested in our video marketing solution',
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-lead-2',
    org_id: 'mock-org',
    name: 'Michael Davis',
    email: 'michael@innovateplus.com',
    phone: '+1 555 9876 5432',
    company: 'InnovatePlus',
    title: 'CEO',
    status: 'replied',
    sentiment: 'positive',
    source: ['Website', 'Google Ads'],
    language: 'en',
    notes: 'Replied positively, wants more information',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-lead-3',
    org_id: 'mock-org',
    name: 'Emma Thompson',
    email: 'e.thompson@mediagroup.com',
    phone: '+1 555 5555 7777',
    company: 'MediaGroup International',
    title: 'Head of Digital',
    status: 'contacted',
    sentiment: 'neutral',
    source: ['Cold Email'],
    language: 'en',
    notes: 'Initial contact sent, waiting for response',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-lead-4',
    org_id: 'mock-org',
    name: 'James Wilson',
    email: 'james@salesforce.com',
    phone: '+1 555 3333 4444',
    company: 'SalesForce Global',
    title: 'Sales Manager',
    status: 'new',
    sentiment: undefined,
    source: ['LinkedIn'],
    language: 'en',
    notes: 'New lead from LinkedIn connection',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-lead-5',
    org_id: 'mock-org',
    name: 'Rachel Anderson',
    email: 'rachel@brandworks.com',
    phone: '+1 555 7777 8888',
    company: 'BrandWorks',
    title: 'Creative Director',
    status: 'meeting_scheduled',
    sentiment: 'positive',
    source: ['Referral', 'Event'],
    language: 'en',
    notes: 'Met at marketing conference, very enthusiastic',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    last_contact_at: new Date().toISOString()
  },
  {
    id: 'mock-lead-6',
    org_id: 'mock-org',
    name: 'Robert Martinez',
    email: 'robert@digitalnow.com',
    company: 'DigitalNow',
    title: 'COO',
    status: 'replied',
    sentiment: 'neutral',
    source: ['Website'],
    language: 'en',
    notes: 'Requested demo information',
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-lead-7',
    org_id: 'mock-org',
    name: 'Jennifer Parker',
    email: 'jennifer@creativelab.com',
    company: 'Creative Lab',
    title: 'Partner',
    status: 'closed',
    sentiment: 'positive',
    source: ['Referral'],
    language: 'en',
    notes: 'Deal closed! Starting next month',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-lead-8',
    org_id: 'mock-org',
    name: 'David Harrison',
    email: 'david@startuphub.com',
    company: 'StartupHub',
    title: 'Founder',
    status: 'contacted',
    sentiment: undefined,
    source: ['Cold Email', 'LinkedIn'],
    language: 'en',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
]

// Mock Meetings
export const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'mock-meeting-1',
    org_id: 'mock-org',
    lead_id: 'mock-lead-1',
    calendly_event_id: 'mock-calendly-1',
    calendly_uri: 'https://calendly.com/demo/mock-event-1',
    event_type_name: 'Product Demo - 30 min',
    event_type_uri: 'https://calendly.com/event-types/demo',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@techcorp.com',
    status: 'active',
    start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), // 2 days from now 10:00
    end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10.5 * 60 * 60 * 1000).toISOString(),
    location: 'Google Meet',
    invitee_name: 'Sarah Johnson',
    invitee_email: 'sarah.johnson@techcorp.com',
    invitee_timezone: 'America/New_York',
    cancel_reason: null,
    cancellation_reason: null,
    rescheduled: false,
    questions_and_answers: [
      { question: 'What would you like to discuss?', answer: 'Video marketing strategy for our campaigns' }
    ],
    tracking: {},
    metadata: {},
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lead: {
      id: 'mock-lead-1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@techcorp.com',
      company: 'TechCorp Solutions'
    }
  },
  {
    id: 'mock-meeting-2',
    org_id: 'mock-org',
    lead_id: 'mock-lead-5',
    calendly_event_id: 'mock-calendly-2',
    calendly_uri: 'https://calendly.com/demo/mock-event-2',
    event_type_name: 'Discovery Call - 45 min',
    event_type_uri: 'https://calendly.com/event-types/discovery',
    name: 'Rachel Anderson',
    email: 'rachel@brandworks.com',
    status: 'active',
    start_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000).toISOString(), // Tomorrow 14:00
    end_time: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 14.75 * 60 * 60 * 1000).toISOString(),
    location: 'Zoom Meeting',
    invitee_name: 'Rachel Anderson',
    invitee_email: 'rachel@brandworks.com',
    invitee_timezone: 'America/Los_Angeles',
    cancel_reason: null,
    cancellation_reason: null,
    rescheduled: false,
    questions_and_answers: [
      { question: 'Company size?', answer: '20-50 employees' }
    ],
    tracking: {},
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lead: {
      id: 'mock-lead-5',
      name: 'Rachel Anderson',
      email: 'rachel@brandworks.com',
      company: 'BrandWorks'
    }
  },
  {
    id: 'mock-meeting-3',
    org_id: 'mock-org',
    lead_id: null,
    calendly_event_id: 'mock-calendly-3',
    calendly_uri: 'https://calendly.com/demo/mock-event-3',
    event_type_name: 'Quick Chat - 15 min',
    event_type_uri: 'https://calendly.com/event-types/quick',
    name: 'Christopher Miller',
    email: 'christopher@example.com',
    status: 'active',
    start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000).toISOString(), // 3 days from now 11:00
    end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 11.25 * 60 * 60 * 1000).toISOString(),
    location: 'Phone Call',
    invitee_name: 'Christopher Miller',
    invitee_email: 'christopher@example.com',
    invitee_timezone: 'America/Chicago',
    cancel_reason: null,
    cancellation_reason: null,
    rescheduled: false,
    questions_and_answers: [],
    tracking: {},
    metadata: {},
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-meeting-4',
    org_id: 'mock-org',
    lead_id: null,
    calendly_event_id: 'mock-calendly-4',
    calendly_uri: 'https://calendly.com/demo/mock-event-4',
    event_type_name: 'Strategy Session - 60 min',
    event_type_uri: 'https://calendly.com/event-types/strategy',
    name: 'Jessica White',
    email: 'jessica@marketing.com',
    status: 'active',
    start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString(), // Next week 9:00
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
    location: 'Microsoft Teams',
    invitee_name: 'Jessica White',
    invitee_email: 'jessica@marketing.com',
    invitee_timezone: 'America/New_York',
    cancel_reason: null,
    cancellation_reason: null,
    rescheduled: false,
    questions_and_answers: [
      { question: 'Main challenge?', answer: 'Need to scale video content production' }
    ],
    tracking: {},
    metadata: {},
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-meeting-5',
    org_id: 'mock-org',
    lead_id: 'mock-lead-2',
    calendly_event_id: 'mock-calendly-5',
    calendly_uri: 'https://calendly.com/demo/mock-event-5',
    event_type_name: 'Follow-up Call - 30 min',
    event_type_uri: 'https://calendly.com/event-types/followup',
    name: 'Michael Davis',
    email: 'michael@innovateplus.com',
    status: 'active',
    start_time: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000).toISOString(), // 4 days from now 15:00
    end_time: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 15.5 * 60 * 60 * 1000).toISOString(),
    location: 'Google Meet',
    invitee_name: 'Michael Davis',
    invitee_email: 'michael@innovateplus.com',
    invitee_timezone: 'America/Denver',
    cancel_reason: null,
    cancellation_reason: null,
    rescheduled: false,
    questions_and_answers: [],
    tracking: {},
    metadata: {},
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lead: {
      id: 'mock-lead-2',
      name: 'Michael Davis',
      email: 'michael@innovateplus.com',
      company: 'InnovatePlus'
    }
  },
  {
    id: 'mock-meeting-6',
    org_id: 'mock-org',
    lead_id: null,
    calendly_event_id: 'mock-calendly-6',
    calendly_uri: 'https://calendly.com/demo/mock-event-6',
    event_type_name: 'Product Demo - 30 min',
    event_type_uri: 'https://calendly.com/event-types/demo',
    name: 'Amanda Collins',
    email: 'amanda@digital.com',
    status: 'active',
    start_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), // 3 days ago (past)
    end_time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 10.5 * 60 * 60 * 1000).toISOString(),
    location: 'Google Meet',
    invitee_name: 'Amanda Collins',
    invitee_email: 'amanda@digital.com',
    invitee_timezone: 'America/New_York',
    cancel_reason: null,
    cancellation_reason: null,
    rescheduled: false,
    questions_and_answers: [],
    tracking: {},
    metadata: {},
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
]

// Mock Activities for Dashboard
export const MOCK_ACTIVITIES = [
  {
    id: 'mock-activity-1',
    type: 'email' as const,
    description: 'Sent follow-up email',
    lead_name: 'Sarah Johnson',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-activity-2',
    type: 'meeting' as const,
    description: 'Meeting scheduled',
    lead_name: 'Rachel Anderson',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-activity-3',
    type: 'email' as const,
    description: 'Initial outreach sent',
    lead_name: 'Michael Davis',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-activity-4',
    type: 'call' as const,
    description: 'Discovery call completed',
    lead_name: 'Emma Thompson',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'mock-activity-5',
    type: 'note' as const,
    description: 'Added prospect notes',
    lead_name: 'James Wilson',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
]