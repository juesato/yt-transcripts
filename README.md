# YouTube Interactive Transcripts

YT Skimmer is designed to enhance the online classroom experience by allowing students to find the information they want through use of interactive transcripts. It streamlines the process of finding the exact portion of each video containing the relevant information, rather than watching the whole video. 

This tool is still under development, possible areas to extend functionality are:

 * Adding in automatic transcript generation.
 * Creating online classes and lecture series
 * Allowing users to add questions to videos, and answer other questions.
 * Creating users, and allowing users to accumulate reputation for contributions.

Feel free to drop me a line if you're interested in contributing or have any suggestions: juesato AT mit DOT edu.


### Setup ###

Install node.js, npm, MongoDB

On Ubuntu 14.04:

    sudo apt-get update
    sudo apt-get install nodejs
    sudo apt-get install npm

For Mongo, I followed the instructions at docs.mongodb.org/manual/tutorial/install-mongodb-on-ubuntu/

Clone the repo, install requirements

    cd yt-transcripts
    npm install

To run the server, run these commands from the project directory (you will need two terminal windows for two processes):

    mongod --dbpath=mydata
    nodejs app.js

The page should now be running at localhost:3000!