import { useState, useEffect, useRef, useCallback } from 'react';
import $ from 'jquery';
import clippy from 'clippyjs';

window.jQuery = $;

const AGENTS = ['Clippy', 'Merlin', 'Rover', 'Links', 'Peedy', 'Bonzi', 'Genius', 'F1'];

const MESSAGES = [
  "It looks like you're trying to win the Protocol Wars. Would you like help?",
  'Your developer has been staring at their screen for 3 hours. This is normal.',
  'TIP: You can increase productivity by hiring more developers. Or by threatening the existing ones.',
  "I see you haven't collected your salary. It's not going anywhere. Neither are you.",
  'Did you know? 73% of protocols fail in their first week. The other 27% fail in their second week.',
  "It looks like you're writing a protocol. Would you like me to add more bugs?",
  "I noticed you haven't opened the Leaderboard in a while. Your competitors are thriving. You are not.",
  'BREAKING: Local developer claims their code works on their machine. Nobody else can confirm.',
  'Your morale slider in Settings does nothing. Just like real corporate morale initiatives.',
  "According to my calculations, you have a 0.3% chance of winning. That's up from yesterday!",
  'The AI Lab is running at peak capacity. It is also on fire. This is fine.',
  'Remember: In the Protocol Wars, the real exploit was the friends we made along the way.',
  "I've been monitoring your clicks. You seem stressed. Have you tried closing this dialog?",
  'Your developer portfolio is performing exactly as expected. Expectations were low.',
  'The blockchain is immutable. Your poor decisions, however, are not.',
  'ALERT: Someone on World Chat claims to be profitable. Investigation pending.',
  'Fun fact: The term "bug" comes from actual insects in old computers. Your bugs are much worse.',
  'I see you changed the wallpaper. Nice. That will definitely help with the Protocol Wars.',
  "Synergy levels are dropping. Quick, adjust the slider! Oh wait, it doesn't do anything.",
  "Your inbox has unread messages. They're mostly disappointment.",
  'Have you tried turning your developers off and on again?',
  'The market is volatile. By which I mean it exists.',
  "I'd suggest investing in DeFi but I'm legally required not to give financial advice. So definitely invest in DeFi.",
  'Your developer just pushed to main without testing. Bold strategy.',
  'ChatGPT thinks it could beat your developers. ChatGPT is probably right.',
  'Elon just tweeted something. Your portfolio changed. These events may be unrelated.',
  'The SEC would like to know your location. Just kidding. Maybe.',
  'Your NFT is now worth exactly one memory. A fond one, hopefully.',
  'Trump just announced a new crypto policy. Markets are confused. So am I.',
  'A whale just dumped. Your developers are now worth negative vibes.',
  'Remember when Bitcoin was $100? Neither do your developers. They were not yet minted.',
  'The real utility of your NFT is the gas fees you spent along the way.',
  'Breaking: Congress still doesn not understand crypto. Markets unchanged.',
];

export default function NXAssistant() {
  const agentRef = useRef(null);
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const messageIndexRef = useRef(0);

  const getAgentName = useCallback(() => {
    return localStorage.getItem('nx-assistant-agent') || 'Clippy';
  }, []);

  const loadAgent = useCallback((agentName) => {
    // Clean up existing agent
    if (agentRef.current) {
      try { agentRef.current.hide(true, () => {}); } catch {}
      agentRef.current = null;
    }
    // Remove any existing clippy elements
    $('.clippy, .clippy-balloon').remove();

    setLoaded(false);

    clippy.load(agentName, (agent) => {
      agentRef.current = agent;
      setLoaded(true);

      // Position in bottom-right area
      agent.moveTo(window.innerWidth - 200, window.innerHeight - 180);
      agent.show();
      agent.play('Greeting');

      // First message after a short delay
      setTimeout(() => {
        const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        agent.speak(msg);
        agent.animate();
      }, 3000);
    }, () => {
      // Error loading - fallback to Clippy
      if (agentName !== 'Clippy') {
        loadAgent('Clippy');
      }
    });
  }, []);

  useEffect(() => {
    const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
    if (!enabled) return;

    const timer = setTimeout(() => {
      loadAgent(getAgentName());
    }, 5000);

    return () => {
      clearTimeout(timer);
      if (agentRef.current) {
        try { agentRef.current.hide(true, () => {}); } catch {}
        agentRef.current = null;
      }
      $('.clippy, .clippy-balloon').remove();
    };
  }, [loadAgent, getAgentName]);

  // Periodic messages
  useEffect(() => {
    if (!loaded) return;

    const interval = setInterval(() => {
      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled || !agentRef.current) return;

      const msg = MESSAGES[messageIndexRef.current % MESSAGES.length];
      messageIndexRef.current++;

      agentRef.current.speak(msg);
      agentRef.current.animate();
    }, 60000 + Math.random() * 60000);

    return () => clearInterval(interval);
  }, [loaded]);

  // Listen for agent change events
  useEffect(() => {
    const handleSettingsChanged = () => {
      const enabled = localStorage.getItem('nx-assistant-enabled') !== 'false';
      if (!enabled) {
        if (agentRef.current) {
          try { agentRef.current.hide(true, () => {}); } catch {}
          agentRef.current = null;
          $('.clippy, .clippy-balloon').remove();
        }
        setLoaded(false);
        return;
      }

      const newAgent = getAgentName();
      // Reload if agent changed
      loadAgent(newAgent);
    };

    window.addEventListener('nx-assistant-changed', handleSettingsChanged);
    return () => window.removeEventListener('nx-assistant-changed', handleSettingsChanged);
  }, [loadAgent, getAgentName]);

  return null; // clippyjs manages its own DOM
}
