function updateStateCircles(tableName, wrapperId, colorArray) {
  const oldWrapper = document.getElementById(wrapperId);
  const newWrapper = document.createElement("div");
  newWrapper.setAttribute("class", "status-wrapper");
  newWrapper.setAttribute("id", wrapperId);
  for (k in colorArray) {
    const color = colorArray[k];
    div = document.createElement("div");
    div.setAttribute("class", "status-indicator");
    div.setAttribute("style", `background-color:${color}`);
    newWrapper.appendChild(div);
  }
  document.getElementById(tableName).replaceChild(newWrapper, oldWrapper);
}

function updateTaskStateCircles(jobRuns) {
  var tasks = {};
  for (i in jobRuns) {
    const taskState = jobRuns[i].state.tasks.state;
    for (taskName in taskState) {
      const state = taskState[taskName];
      const color = stateColor(state);
      if (taskName in tasks) {
        tasks[taskName].push(color);
      } else {
        tasks[taskName] = [color];
      }
    }
  }
  for (task in tasks) {
    updateStateCircles("task-table", task, tasks[task]);
  }
}

function updateJobStateCircles() {
  var stream = new EventSource(`/stream`);
  stream.addEventListener("message", function(e) {
    const data = JSON.parse(e.data);
    const jobRunStates = data.jobRuns.map(getJobRunState);
    updateStateCircles("job-table", data.jobName, jobRunStates);
  });
}

function updateGraphViz(jobRuns) {
  if (jobRuns.length) {
    const lastJobRun = jobRuns.reverse()[0]
    const taskState = lastJobRun.state.tasks.state;
    for (taskName in taskState) {
      if (document.getElementsByClassName("output")) {
        const taskRunColor = getJobRunTaskColor(lastJobRun, taskName);
	try {
          const rect = document.getElementById("node-" + taskName).querySelector("rect");
          rect.setAttribute("style", "stroke-width: 2; stroke: " + taskRunColor);
	}
	catch(err) {
          console.log(`${err}. This might be a temporary error when the graph is still loading.`)
	}
      }
    }
  }
}

function updateLastRunTs(jobRuns) {
  if (jobRuns.reverse()[0]) {
    const lastJobRunTs = jobRuns.reverse()[0].submitted;
    const lastJobRunTsHTML = document.getElementById("last-job-run-ts-wrapper").innerHTML;
    const newHTML = lastJobRunTsHTML.replace(/.*/, `Last run: ${lastJobRunTs}`);
    document.getElementById("last-job-run-ts-wrapper").innerHTML = newHTML;
  }
}

function updateJobActive(jobName) {
  fetch(`/api/jobs/${jobName}`)
    .then(response => response.json())
    .then(data => {
      if (data.active) {
        document
          .getElementById("schedule-badge-" + jobName)
          .setAttribute("class", "schedule-badge-active-true");
      } else {
        document
          .getElementById("schedule-badge-" + jobName)
          .setAttribute("class", "schedule-badge-active-false");
      }
    })
}

function readTaskStream(jobName) {
  var stream = new EventSource(`/stream`);
  stream.addEventListener("message", function(e) {
    const data = JSON.parse(e.data);
    if (jobName == data.jobName) {
      updateTaskStateCircles(data.jobRuns);
      updateGraphViz(data.jobRuns);
      updateLastRunTs(data.jobRuns);
    }
  });
}

function stateColor(taskState) {
  switch (taskState) {
    case "running":
      var color = "#dffbe3";
      break;
    case "upforretry":
      var color = "#ffc620";
      break;
    case "successful":
      var color = "#39c84e";
      break;
    case "skipped":
      var color = "#abbefb";
      break;
    case "failed":
      var color = "#ff4020";
      break;
    case "notstarted":
      var color = "white";
      break;
  }

  return color
}

function getJobRunTaskColor(jobRun, task) {
  const taskState = jobRun.state.tasks.state[task];
  return stateColor(taskState)
}

function getJobRunState(jobRun) {
  return stateColor(jobRun.state.job)
}

function submit(jobName) {
  const xhttp = new XMLHttpRequest();
  xhttp.open("POST", `/api/jobs/${jobName}/submit`, true);
  xhttp.send();
}

async function toggle(jobName) {
  const options = {
    method: 'POST'
  }
  await fetch(`/api/jobs/${jobName}/toggle`, options)
    .then(updateJobActive(jobName))
}