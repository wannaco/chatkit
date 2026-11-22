export interface MenuItem {
	key: string;
	response: any;
	children_options: { key: string; label: string }[];
	_parentKey: string;
	_parentLabel: string;
}

export interface BotMessages {
	INITIAL_RESPONSE?: string;
	MENU_PROMPT?: string;
	FORM_INTRO_MESSAGE?: string;
	FORM_COMPLETE_MESSAGE?: string;
	BACK_KEYWORDS?: string[];
	HOME_KEYWORDS?: string[];
}

export interface MenuTemplate {
	id: string;
	label: string;
	description: string;
	icon: string;
	botMessages?: BotMessages;
	menuItems: MenuItem[];
}

export const MENU_TEMPLATES: MenuTemplate[] = [
	{
		id: 'restaurant',
		label: 'Restaurant',
		description: 'Menu browsing, reservations, hours & location',
		icon: '🍽️',
		botMessages: {
			INITIAL_RESPONSE: 'Welcome! How can we help you today?',
			MENU_PROMPT: 'Please select an option:',
			FORM_INTRO_MESSAGE: 'Please share a few details to complete your reservation.',
			FORM_COMPLETE_MESSAGE: 'Thank you! Your reservation request has been received. We will confirm shortly.',
			BACK_KEYWORDS: ['Back'],
			HOME_KEYWORDS: ['Home']
		},
		menuItems: [
			{
				key: 'Browse Menu',
				response: { content_type: 'submenu' },
				children_options: [
					{ key: 'Starters', label: 'Starters' },
					{ key: 'Main Course', label: 'Main Course' },
					{ key: 'Desserts & Drinks', label: 'Desserts & Drinks' }
				],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Starters',
				response: '🥗 Bruschetta — $8\n🍲 Soup of the Day — $7\n🧆 Crispy Calamari — $12\n\nType *Back* to return to the menu.',
				children_options: [],
				_parentKey: 'Browse Menu',
				_parentLabel: 'Browse Menu'
			},
			{
				key: 'Main Course',
				response: '🥩 Grilled Ribeye — $28\n🍝 Pasta Carbonara — $18\n🐟 Pan-Seared Salmon — $24\n🥦 Vegetable Risotto — $16\n\nType *Back* to return.',
				children_options: [],
				_parentKey: 'Browse Menu',
				_parentLabel: 'Browse Menu'
			},
			{
				key: 'Desserts & Drinks',
				response: '🍰 Tiramisu — $9\n🍫 Chocolate Lava Cake — $10\n🍷 House Wine (glass) — $8\n☕ Espresso — $4\n\nType *Back* to return.',
				children_options: [],
				_parentKey: 'Browse Menu',
				_parentLabel: 'Browse Menu'
			},
			{
				key: 'Make a Reservation',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'name', label: 'Your Name', type: 'text', placeholder: 'John Smith', default: '' },
							{ name: 'date', label: 'Preferred Date', type: 'text', placeholder: 'e.g. Friday 7pm', default: '' },
							{ name: 'guests', label: 'Number of Guests', type: 'text', placeholder: 'e.g. 4', default: '' },
							{ name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Hours & Location',
				response: '📍 123 Main Street, City\n🕐 Mon–Fri: 11am – 10pm\n🕐 Sat–Sun: 10am – 11pm\n\nType *Home* to go back to the main menu.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Contact Us',
				response: 'You can reach us at:\n📞 +1 (555) 000-0000\n📧 hello@restaurant.com\n\nOr visit us at 123 Main Street. Type *Home* to return.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			}
		]
	},

	{
		id: 'ecommerce',
		label: 'E-commerce Support',
		description: 'Order tracking, returns, product info, live agent',
		icon: '🛍️',
		botMessages: {
			INITIAL_RESPONSE: 'Hi there! Welcome to our support chat. How can we assist you?',
			MENU_PROMPT: 'Please choose an option:',
			FORM_INTRO_MESSAGE: 'Please provide your details so we can look up your order.',
			FORM_COMPLETE_MESSAGE: 'Thank you! We have received your request and will follow up via email shortly.',
			BACK_KEYWORDS: ['Back'],
			HOME_KEYWORDS: ['Home']
		},
		menuItems: [
			{
				key: 'Track My Order',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'order_number', label: 'Order Number', type: 'text', placeholder: 'e.g. ORD-12345', default: '' },
							{ name: 'email', label: 'Email Address', type: 'email', placeholder: 'name@example.com', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Returns & Refunds',
				response: 'We offer a 30-day hassle-free return policy.\n\n✅ Items must be unused and in original packaging.\n✅ Refunds are processed within 5–7 business days.\n\nTo start a return, visit https://example.com/returns or type *Back* to see other options.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Product Information',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'product_name', label: 'Product Name or SKU', type: 'text', placeholder: 'e.g. Blue Sneaker XL', default: '' },
							{ name: 'question', label: 'Your Question', type: 'text', placeholder: 'e.g. Is this available in size 10?', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Talk to an Agent',
				response: 'Connecting you to a live support agent now. Please hold on — average wait time is under 2 minutes. 🎧',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			}
		]
	},

	{
		id: 'healthcare',
		label: 'Healthcare / Clinic',
		description: 'Appointments, services, hours, emergency contact',
		icon: '🏥',
		botMessages: {
			INITIAL_RESPONSE: 'Hello! Welcome to our clinic. How can we help you today?',
			MENU_PROMPT: 'Please select an option:',
			FORM_INTRO_MESSAGE: 'Please fill in the following details to book your appointment.',
			FORM_COMPLETE_MESSAGE: 'Thank you! Your appointment request has been submitted. Our team will confirm within 24 hours.',
			BACK_KEYWORDS: ['Back'],
			HOME_KEYWORDS: ['Home']
		},
		menuItems: [
			{
				key: 'Book an Appointment',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Doe', default: '' },
							{ name: 'dob', label: 'Date of Birth', type: 'text', placeholder: 'MM/DD/YYYY', default: '' },
							{ name: 'reason', label: 'Reason for Visit', type: 'text', placeholder: 'e.g. General checkup', default: '' },
							{ name: 'preferred_date', label: 'Preferred Date & Time', type: 'text', placeholder: 'e.g. Monday afternoon', default: '' },
							{ name: 'phone', label: 'Phone Number', type: 'text', placeholder: '+1 (555) 000-0000', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Our Services',
				response: { content_type: 'submenu' },
				children_options: [
					{ key: 'General Medicine', label: 'General Medicine' },
					{ key: 'Pediatrics', label: 'Pediatrics' },
					{ key: 'Dental Care', label: 'Dental Care' }
				],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'General Medicine',
				response: 'Our general medicine department handles routine checkups, chronic disease management, vaccinations, and more.\n\nType *Back* to return to Services.',
				children_options: [],
				_parentKey: 'Our Services',
				_parentLabel: 'General Medicine'
			},
			{
				key: 'Pediatrics',
				response: 'Our pediatric team specializes in child health from newborns to teens — including growth monitoring, immunizations, and illness care.\n\nType *Back* to return.',
				children_options: [],
				_parentKey: 'Our Services',
				_parentLabel: 'Pediatrics'
			},
			{
				key: 'Dental Care',
				response: 'We offer cleanings, fillings, orthodontics, and cosmetic dentistry. Book a consultation today!\n\nType *Back* to return.',
				children_options: [],
				_parentKey: 'Our Services',
				_parentLabel: 'Dental Care'
			},
			{
				key: 'Hours & Location',
				response: '📍 456 Health Ave, Suite 100\n🕐 Mon–Fri: 8am – 6pm\n🕐 Saturday: 9am – 1pm\n🚫 Sunday: Closed\n\nType *Home* to return to the main menu.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Emergency',
				response: '🚨 If this is a medical emergency, please call 911 immediately.\n\n📞 For urgent (non-emergency) care: +1 (555) 999-0000\n\nOur on-call team is available 24/7 for registered patients.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			}
		]
	},

	{
		id: 'realestate',
		label: 'Real Estate',
		description: 'Buy, rent, sell properties, contact an agent',
		icon: '🏠',
		botMessages: {
			INITIAL_RESPONSE: 'Welcome to our real estate agency! How can we assist you today?',
			MENU_PROMPT: 'Please choose what you are looking for:',
			FORM_INTRO_MESSAGE: 'Please share your details so one of our agents can reach out.',
			FORM_COMPLETE_MESSAGE: 'Thank you! An agent will contact you within 1 business day.',
			BACK_KEYWORDS: ['Back'],
			HOME_KEYWORDS: ['Home']
		},
		menuItems: [
			{
				key: 'Buy a Property',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Doe', default: '' },
							{ name: 'budget', label: 'Budget Range', type: 'text', placeholder: 'e.g. $300k – $500k', default: '' },
							{ name: 'location', label: 'Preferred Location', type: 'text', placeholder: 'e.g. Downtown, Suburbs', default: '' },
							{ name: 'bedrooms', label: 'Bedrooms Needed', type: 'text', placeholder: 'e.g. 3', default: '' },
							{ name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Rent a Property',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'name', label: 'Full Name', type: 'text', placeholder: 'Jane Doe', default: '' },
							{ name: 'monthly_budget', label: 'Monthly Budget', type: 'text', placeholder: 'e.g. $1,500/mo', default: '' },
							{ name: 'move_in', label: 'Move-in Date', type: 'text', placeholder: 'e.g. June 1st', default: '' },
							{ name: 'area', label: 'Preferred Area', type: 'text', placeholder: 'e.g. City center', default: '' },
							{ name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Sell My Property',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'name', label: 'Your Name', type: 'text', placeholder: 'Jane Doe', default: '' },
							{ name: 'property_address', label: 'Property Address', type: 'text', placeholder: '123 Main St', default: '' },
							{ name: 'property_type', label: 'Property Type', type: 'text', placeholder: 'e.g. House, Apartment, Land', default: '' },
							{ name: 'phone', label: 'Phone Number', type: 'text', placeholder: '+1 (555) 000-0000', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Contact an Agent',
				response: 'Our agents are available Mon–Sat, 9am – 6pm.\n\n📞 +1 (555) 123-4567\n📧 agents@realty.com\n\nOr type *Home* to return to the main menu.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			}
		]
	},

	{
		id: 'support',
		label: 'General Support',
		description: 'Technical help, billing, account, escalation',
		icon: '🎧',
		botMessages: {
			INITIAL_RESPONSE: 'Hi! Welcome to our support center. We are here to help.',
			MENU_PROMPT: 'What do you need help with?',
			FORM_INTRO_MESSAGE: 'Please provide some details about your issue.',
			FORM_COMPLETE_MESSAGE: 'Thank you! Your ticket has been submitted. Our team will get back to you within 24 hours.',
			BACK_KEYWORDS: ['Back'],
			HOME_KEYWORDS: ['Home']
		},
		menuItems: [
			{
				key: 'Technical Help',
				response: { content_type: 'submenu' },
				children_options: [
					{ key: 'App Not Working', label: 'App Not Working' },
					{ key: 'Login Issues', label: 'Login Issues' },
					{ key: 'Report a Bug', label: 'Report a Bug' }
				],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'App Not Working',
				response: 'Try these steps:\n1. Force-close and reopen the app\n2. Check your internet connection\n3. Update to the latest version\n4. Restart your device\n\nIf the issue persists, type *Back* to report a bug.',
				children_options: [],
				_parentKey: 'Technical Help',
				_parentLabel: 'App Not Working'
			},
			{
				key: 'Login Issues',
				response: 'Having trouble logging in?\n\n• Forgot password → tap "Forgot password" on the login screen\n• Locked account → contact support below\n• 2FA issues → check your authenticator app\n\nType *Back* or *Home* for more options.',
				children_options: [],
				_parentKey: 'Technical Help',
				_parentLabel: 'Login Issues'
			},
			{
				key: 'Report a Bug',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'description', label: 'Describe the issue', type: 'text', placeholder: 'What went wrong?', default: '' },
							{ name: 'steps', label: 'Steps to reproduce', type: 'text', placeholder: 'What did you do before it happened?', default: '' },
							{ name: 'email', label: 'Your Email', type: 'email', placeholder: 'name@example.com', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: 'Technical Help',
				_parentLabel: 'Report a Bug'
			},
			{
				key: 'Billing & Payments',
				response: { content_type: 'submenu' },
				children_options: [
					{ key: 'View Invoice', label: 'View Invoice' },
					{ key: 'Billing Problem', label: 'Billing Problem' }
				],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'View Invoice',
				response: 'You can download your invoices from your account dashboard at https://example.com/billing\n\nNeed help? Type *Back* or contact support.',
				children_options: [],
				_parentKey: 'Billing & Payments',
				_parentLabel: 'View Invoice'
			},
			{
				key: 'Billing Problem',
				response: {
					content: 'form',
					content_type: 'sequential_form',
					content_attributes: {
						items: [
							{ name: 'issue', label: 'Describe the billing issue', type: 'text', placeholder: 'e.g. Charged twice, wrong amount', default: '' },
							{ name: 'invoice_number', label: 'Invoice Number (if known)', type: 'text', placeholder: 'INV-0001', default: '' },
							{ name: 'email', label: 'Email on Account', type: 'email', placeholder: 'name@example.com', default: '' }
						]
					}
				},
				children_options: [],
				_parentKey: 'Billing & Payments',
				_parentLabel: 'Billing Problem'
			},
			{
				key: 'Account Settings',
				response: 'To manage your account:\n\n• Change email or password → go to Account Settings in the app\n• Delete account → contact support at support@example.com\n• Update billing info → go to Billing section\n\nType *Home* to return.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			},
			{
				key: 'Talk to a Human',
				response: 'Transferring you to a live support agent now. 🎧\n\nAvailable Mon–Fri, 9am – 6pm (EST). If outside hours, we will follow up by email.',
				children_options: [],
				_parentKey: '',
				_parentLabel: ''
			}
		]
	}
];
