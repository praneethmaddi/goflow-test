package goflow

import (
	"log"
	"math"
	"time"
)

// TaskParams define optional task parameters.
type TaskParams struct {
	TriggerRule triggerRule
	Retries     int
	RetryDelay  RetryDelay
}

// A Task is the unit of work that makes up a job. Whenever a task is executed, it
// calls its associated operator.
type Task struct {
	Name              string
	Operator          Operator
	Params            TaskParams
	attemptsRemaining int
}

func (t *Task) run(writes chan writeOp) error {
	res, err := t.Operator.Run()
	logMsg := "task %v reached state %v - %v attempt(s) remaining - result %v"

	if err != nil && t.attemptsRemaining > 0 {
		log.Printf(logMsg, t.Name, upForRetry, t.attemptsRemaining, err)
		write := writeOp{t.Name, upForRetry, make(chan bool)}
		writes <- write
		<-write.resp
		return nil
	}

	if err != nil && t.attemptsRemaining <= 0 {
		log.Printf(logMsg, t.Name, failed, t.attemptsRemaining, err)
		write := writeOp{t.Name, failed, make(chan bool)}
		writes <- write
		<-write.resp
		return err
	}

	log.Printf(logMsg, t.Name, successful, t.attemptsRemaining, res)
	write := writeOp{t.Name, successful, make(chan bool)}
	writes <- write
	<-write.resp
	return nil
}

func (t *Task) skip(writes chan writeOp) error {
	logMsg := "task %v reached state %v"
	log.Printf(logMsg, t.Name, skipped)
	write := writeOp{t.Name, skipped, make(chan bool)}
	writes <- write
	<-write.resp
	return nil
}

// RetryDelay is a type that implements a Wait() method, which is called in between
// task retry attempts.
type RetryDelay interface {
	wait(taskName string, attempt int)
}

// ConstantRetryDelay waits a constant number of seconds between task retries.
type ConstantRetryDelay struct {
	Period int
}

// ConstantDelay returns a ConstantRetryDelay.
func ConstantDelay(period int) *ConstantRetryDelay {
	return &ConstantRetryDelay{Period: period}
}

func (d *ConstantRetryDelay) wait(taskName string, attempt int) {
	log.Printf("waiting %v second(s) to retry task %v", d.Period, taskName)
	time.Sleep(time.Duration(d.Period) * time.Second)
}

// ExpBackoffRetryDelay waits exponentially longer between each retry attempt.
type ExpBackoffRetryDelay struct {
}

// ExponentialBackoff returns an ExpBackoffRetryDelay.
func ExponentialBackoff() *ExpBackoffRetryDelay {
	return &ExpBackoffRetryDelay{}
}

func (d *ExpBackoffRetryDelay) wait(taskName string, attempt int) {
	delay := math.Pow(2, float64(attempt))
	log.Printf("waiting %v seconds to retry task %v", delay, taskName)
	time.Sleep(time.Duration(delay) * time.Second)
}
