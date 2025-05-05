'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, Send, ArrowRight, Code } from 'lucide-react';

const PgTrackEventsHero = () => {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Clear animation cycle and restart
  useEffect(() => {
    if (!autoPlay) return;
    
    // Complete animation cycle
    const timer = setTimeout(() => {
      // Reset to beginning after completing the cycle
      if (step === 4) {
        setStep(0);
        const restartTimer = setTimeout(() => setStep(1), 1500);
        return () => clearTimeout(restartTimer);
      } else {
        setStep(step + 1);
      }
    }, step === 0 ? 1000 : step === 3 ? 2500 : 2000); // First step transitions faster, longer pause on destinations
    
    return () => clearTimeout(timer);
  }, [step, autoPlay]);

  // Data objects for visualization
  const sqlStatement = `INSERT INTO "user"
(id, name, email)
VALUES (
  '64a2f1d9',
  'Jane Smith',
  'jane@icloud.me'
);`

  const configSnippet = `user.insert:
    event: "user_signup"
    properties:
        id: "new.id"
        email: "new.email"
        name: "new.name"`
  
  const trackingEvent = {
    event: 'user_signup',
    properties: {
      id: '64a2f1d9',
      name: 'Jane Smith',
      email: 'jane@icloud.me'
    }
  };

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } }
  };
  
  const highlight = {
    initial: { backgroundColor: '#f3f4f6' },
    active: { 
      backgroundColor: '#dcfce7',
      boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)',
      scale: 1.05,
      transition: { duration: 0.3 }
    },
    inactive: {
      backgroundColor: '#f3f4f6',
      boxShadow: '0 0 0px rgba(34, 197, 94, 0)',
      scale: 1,
      transition: { duration: 0.5, delay: 0.3 }
    }
  };

  // Data particle that flows between sections
  const DataParticle = ({ isActive, startPosition }: { isActive: boolean, startPosition: number }) => (
    <motion.div
      className="absolute top-1/2 transform -translate-y-1/2"
      initial={{ x: startPosition, opacity: 0 }}
      animate={isActive ? { 
        x: [startPosition, startPosition + 170],
        opacity: [0, 1, 0.8, 0]
      } : { x: startPosition, opacity: 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    >
      <motion.div 
        className="h-3 w-3 rounded-full bg-green-500"
        animate={isActive ? { 
          scale: [0.8, 1.2, 0.8],
          boxShadow: [
            '0 0 0px rgba(34, 197, 94, 0)',
            '0 0 6px rgba(34, 197, 94, 0.7)',
            '0 0 0px rgba(34, 197, 94, 0)'
          ]
        } : {}}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
    </motion.div>
  );
  
  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 p-8 rounded-xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 relative">
        {/* PostgreSQL Section */}
        <div className="w-1/4 flex flex-col items-center p-4">
          <motion.div
            className="rounded-full p-4 bg-blue-100"
            initial="hidden"
            animate={step >= 1 ? "visible" : "hidden"}
            variants={fadeIn}
          >
            <Database size={32} className="text-blue-600" />
          </motion.div>
          
          <motion.h3 
            className="font-bold text-lg mt-2 mb-4 text-blue-800"
            initial="hidden"
            animate={step >= 1 ? "visible" : "hidden"}
            variants={fadeIn}
          >
            PostgreSQL
          </motion.h3>
          
          <motion.div
            className="w-full bg-white p-3 rounded-lg shadow-sm"
            initial="initial"
            animate={step === 1 ? "active" : step > 1 ? "inactive" : "initial"}
            variants={highlight}
          >
            <div className="text-xs font-mono text-gray-500 mb-1">Database Operation</div>
            <div className="font-mono text-sm text-left">
              <pre><code>{sqlStatement}</code></pre>
            </div>
          </motion.div>
        </div>
        
        {/* Connection Line 1 */}
        <div className="w-1/6 relative h-6">
          <motion.div 
            className="absolute top-1/2 h-1 bg-gray-300 w-full transform -translate-y-1/2"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <DataParticle isActive={step === 1} startPosition={0} />
        </div>
        
        {/* pg_track_events Section */}
        <div className="w-1/4 flex flex-col items-center p-4">
          <motion.div
            className="rounded-full p-4 bg-green-100"
            initial="hidden"
            animate={step >= 1 ? "visible" : "hidden"}
            variants={fadeIn}
          >
            <Zap size={32} className="text-green-600" />
          </motion.div>
          
          <motion.h3 
            className="font-bold text-lg mt-2 mb-4 text-green-800"
            initial="hidden"
            animate={step >= 1 ? "visible" : "hidden"}
            variants={fadeIn}
          >
            pg_track_events
          </motion.h3>
          
          <motion.div
            className="w-full flex flex-col gap-3"
          >
            <motion.div
              className="bg-white p-3 rounded-lg shadow-sm"
              initial={{ opacity: 0.5 }}
              animate={step >= 2 ? { opacity: 1 } : { opacity: 0.5 }}
            >
              <div className="text-xs font-mono text-gray-500 mb-1">Configuration</div>
              <div className="font-mono text-sm text-gray-800 text-left">
                <pre><code>{configSnippet}</code></pre>
              </div>
            </motion.div>
            
            <motion.div
              className="bg-white p-3 rounded-lg shadow-sm"
              initial="initial"
              animate={step === 2 ? "active" : step > 2 ? "inactive" : "initial"}
              variants={highlight}
            >
              <div className="text-xs font-mono text-gray-500 mb-1">Transformed Event</div>
              <div className="font-mono text-sm text-left">
                <pre><code>{JSON.stringify(trackingEvent, null, 2)}</code></pre>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Connection Line 2 */}
        <div className="w-1/6 relative h-6">
          <motion.div 
            className="absolute top-1/2 h-1 bg-gray-300 w-full transform -translate-y-1/2"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          />
          <DataParticle isActive={step === 2} startPosition={0} />
        </div>
        
        {/* Destinations Section */}
        <div className="w-1/4 flex flex-col items-center p-4">
          <motion.div
            className="rounded-full p-4 bg-purple-100"
            initial="hidden"
            animate={step >= 1 ? "visible" : "hidden"}
            variants={fadeIn}
          >
            <Send size={32} className="text-purple-600" />
          </motion.div>
          
          <motion.h3 
            className="font-bold text-lg mt-2 mb-4 text-purple-800"
            initial="hidden"
            animate={step >= 1 ? "visible" : "hidden"}
            variants={fadeIn}
          >
            Destinations
          </motion.h3>
          
          <div className="w-full space-y-2">
            {/* Mixpanel */}
            <motion.div
              className="flex items-center bg-white p-3 rounded-lg shadow-sm"
              initial={{ opacity: 0.5, y: 10 }}
              animate={step >= 3 ? { 
                opacity: 1, 
                y: 0,
                backgroundColor: step === 3 ? '#f0fdf4' : '#ffffff',
                transition: { 
                  backgroundColor: { duration: 0.8, delay: step === 3 ? 0 : 0.5 } 
                }
              } : { opacity: 0.5, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-8 h-8 rounded bg-purple-500 flex items-center justify-center text-white font-bold mr-3"
                animate={step === 3 ? { 
                  scale: [1, 1.15, 1],
                  transition: { duration: 0.6, delay: 0.1 }
                } : {}}
              >
                M
              </motion.div>
              <div className="text-sm font-medium">Mixpanel</div>
              {step >= 3 && (
                <motion.div 
                  className="ml-auto text-green-600 font-semibold"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  ✓
                </motion.div>
              )}
            </motion.div>
            
            {/* PostHog */}
            <motion.div
              className="flex items-center bg-white p-3 rounded-lg shadow-sm"
              initial={{ opacity: 0.5, y: 10 }}
              animate={step >= 3 ? { 
                opacity: 1, 
                y: 0,
                backgroundColor: step === 3 ? '#f0fdf4' : '#ffffff',
                transition: { 
                  backgroundColor: { duration: 0.8, delay: step === 3 ? 0 : 0.5 } 
                }
              } : { opacity: 0.5, y: 10 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <motion.div
                className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center text-white font-bold mr-3"
                animate={step === 3 ? { 
                  scale: [1, 1.15, 1],
                  transition: { duration: 0.6, delay: 0.2 }
                } : {}}
              >
                P
              </motion.div>
              <div className="text-sm font-medium">PostHog</div>
              {step >= 3 && (
                <motion.div 
                  className="ml-auto text-green-600 font-semibold"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  ✓
                </motion.div>
              )}
            </motion.div>
            
            {/* BigQuery */}
            <motion.div
              className="flex items-center bg-white p-3 rounded-lg shadow-sm"
              initial={{ opacity: 0.5, y: 10 }}
              animate={step >= 3 ? { 
                opacity: 1, 
                y: 0,
                backgroundColor: step === 3 ? '#f0fdf4' : '#ffffff',
                transition: { 
                  backgroundColor: { duration: 0.8, delay: step === 3 ? 0 : 0.5 } 
                }
              } : { opacity: 0.5, y: 10 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <motion.div
                className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center text-white font-bold mr-3"
                animate={step === 3 ? { 
                  scale: [1, 1.15, 1],
                  transition: { duration: 0.6, delay: 0.3 }
                } : {}}
              >
                B
              </motion.div>
              <div className="text-sm font-medium">BigQuery</div>
              {step >= 3 && (
                <motion.div 
                  className="ml-auto text-green-600 font-semibold"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  ✓
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Caption */}
      <div className="text-center mt-6">
        <motion.h2 
          className="text-2xl font-bold text-gray-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Database Changes → Analytics Events
        </motion.h2>
        <motion.p 
          className="text-gray-600 mt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          TODO
        </motion.p>
      </div>
    </div>
  );
};

export default PgTrackEventsHero;
