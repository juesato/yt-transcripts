# YouTube Interactive Transcripts

Website for interactive transcripts. Designed to make video lectures easier to follow along, and quickly find relevant sections.

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
