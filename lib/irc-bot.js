/*
 * irc-bot
 * https://github.com/jthomerson/node-irc-bot
 *
 * Copyright (c) 2014 Jeremy Thomerson
 * Licensed under the MIT license.
 */
var IRC      = require('irc'),
    util     = require('util');

function trim(str) {
   return str.replace(/^\s+|\s+$/g, '');
}

function Bot(config) {
   this.config = config;
   this.commands = [];
   this.checkConfig();
}

Bot.prototype = {

   checkConfig: function() {
      if (!this.config || !this.config.host || !this.config.nick || !this.config.channels) {
         throw new Error('config is required and must have host, nick, and channels');
      }
   },

   start: function() {
      if (this.running) {
         console.log('bot was already running and can not be restarted');
         return;
      }
      this.irc = new IRC.Client(this.config.host, this.config.nick, {
         channels: this.config.channels
      });
      this.listeners();
      this.running = true;
   },

   handleMention: function(from, to) {
      this.irc.action(to, 'thinks ' + from + ' was talking to me, but doesn\'t understand what ' + from + ' said');
   },

   listeners: function() {
      var bot = this;
      this.irc.addListener('message', function(from, to, message) {
         console.log('message [' + from + ' => ' + to + ']: ' + message);
         if (from !== bot.config.nick) {
            var nickInd = message.indexOf(bot.config.nick);
            if (nickInd === 0) {
               var command = message.substr(message.indexOf(' '));
               bot.handlePotentialCommand(from, to, command);
            } else {
               bot.handleMention(from, to, message);
            }
         }
      });

      this.irc.addListener('pm', function(from, message) {
         console.log('pm [' + from + ']: ' + message);
         bot.handlePotentialCommand(from, from, message);
      });

      this.irc.addListener('error', function(err) {
         console.log('IRC error: ' + util.inspect(err));
      });
   },

   command: function(regex, cmd) {
      this.commands.push({ regex: regex, cmd: cmd});
   },

   splitArgs: function(cmd) {
      return cmd.split(' ').filter(function(arg) {
         return trim(arg) !== '';
      });
   },

   handlePotentialCommand: function(from, to, userCmd) {
      userCmd = trim(userCmd);
      console.log('user cmd: ' + userCmd);
      for (var i = 0; i < this.commands.length; i++) {
         var regex = this.commands[i].regex,
             cmd   = this.commands[i].cmd;

         if (userCmd.match(regex)) {
            cmd.respond(this.irc, from, to, this.splitArgs(userCmd), userCmd);
            return true;
         }
      }
      this.handleNoCommandFound(from, to, userCmd);
   },

   handleNoCommandFound: function(from, to, userCmd) {
      if (!userCmd.match(/help/i)) {
         this.handlePotentialCommand(from, to, 'help');
      }
   },

   simpleCommand: function(name, helpStr, response) {
      var cmd = {
         name: name,
         help: function() { return helpStr; },
         respond: response
      };
      this.command(new RegExp(name, 'i'), cmd);
   },

   addStandardHelpCommand: function() {
      var bot = this;
      bot.command(/help/i, {
         name: 'help',

         help: function() {
            return '<noargs> displays helpful information about bot capabilities';
         },

         respond: function(irc, from, to, args) {
            if (args.length > 1) {
               // user supplied a specific command they wanted help with
               for (var i = 0; i < bot.commands.length; i++) {
                  var cmd = bot.commands[i].cmd;
                  if (cmd.name === args[1]) {
                     if (cmd.help) {
                        irc.say(to, cmd.name + ': ' + cmd.help());
                        return true;
                     }
                     return false;
                  }
               }
            }

            this.respondNoCommand(irc, from, to);
         },

         respondNoCommand: function(irc, from, to) {
            irc.say(to, from + ': I sent some help to you in a private message.');
            irc.say(from, 'Sorry, I didn\'t understand your command for me.');
            irc.say(from, 'I do understand the following commands:');
            var names = '';
            for (var i = 0; i < bot.commands.length; i++) {
               var cmd = bot.commands[i].cmd;
               names += cmd.name + (i < (bot.commands.length - 1) ? ', ' : '');
            }
            irc.say(from, names);
            irc.say(from, 'For more help on one of these commands, try "help [cmd]"');
         }
      });
   }

};


module.exports = Bot;
